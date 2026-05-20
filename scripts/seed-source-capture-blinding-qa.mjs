/**
 * Staging — seed QA source capture blinding fields on a real procedure.
 *
 * Usage:
 *   npm run db:seed-source-capture-blinding-qa
 *
 * Env:
 *   CALENDAR_QA_STUDY_ID (default phase-2 study)
 *   CALENDAR_QA_ORG_ID
 *   CALENDAR_SEED_ALLOW_ANY_ORG=true
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const DEFAULT_STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const QA_PASSWORD = 'RbacBlindingQa!2026'
const QA_FIELD_BLINDED = 'qa_blinded_field'
const QA_FIELD_UNBLINDED = 'qa_unblinded_field'
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tmp',
  'source-capture-blinding-qa-fixture.json',
)

const PI_QA_USER = {
  email: 'rbac.qa.pi_sub_i@vilo-os.staging',
  displayName: 'RBAC QA PI Sub-I',
  role: 'pi_sub_i',
}

/** study_members.role — required by open_source_response_set (user_can_manage_subject_enrollment). */
const STUDY_MEMBER_ROLE_BY_PERSONA = {
  research_coordinator: 'coordinator',
  data_coordinator: 'coordinator',
  unblinded_coordinator: 'coordinator',
  unblinded_cra: 'lab',
  pi_sub_i: 'study_admin',
  read_only: 'viewer',
}

function assertStagingTarget(org) {
  if (process.env.CALENDAR_SEED_ALLOW_ANY_ORG === 'true') return
  const name = org?.name ?? ''
  if (!/staging/i.test(name) && !/synthetic/i.test(name) && !/phase\s*2/i.test(name)) {
    throw new Error(`Refusing to seed non-staging org: ${name}`)
  }
}

async function findUserByEmail(admin, email) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data?.users?.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }
  return null
}

async function ensurePiUser(admin, orgId) {
  let user = await findUserByEmail(admin, PI_QA_USER.email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: PI_QA_USER.email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: PI_QA_USER.displayName },
    })
    if (error) throw error
    user = data.user
    console.log(`  Created PI QA user: ${PI_QA_USER.email}`)
  }
  await admin.from('profiles').upsert({ id: user.id, display_name: PI_QA_USER.displayName })
  await admin.from('organization_members').upsert(
    {
      organization_id: orgId,
      user_id: user.id,
      role: PI_QA_USER.role,
      roles: [PI_QA_USER.role],
    },
    { onConflict: 'organization_id,user_id' },
  )
  return user.id
}

async function ensureStudyMemberships(admin, orgId, studyId, qaUsersByPersona) {
  for (const [persona, email] of Object.entries(qaUsersByPersona)) {
    const studyRole = STUDY_MEMBER_ROLE_BY_PERSONA[persona]
    if (!studyRole) continue
    const user = await findUserByEmail(admin, email)
    if (!user) {
      console.warn(`  Skip study_members — user missing: ${email} (run db:seed-rbac-blinding-qa)`)
      continue
    }
    const { error } = await admin.from('study_members').upsert(
      {
        organization_id: orgId,
        study_id: studyId,
        user_id: user.id,
        role: studyRole,
      },
      { onConflict: 'study_id,user_id' },
    )
    if (error) throw new Error(`study_members ${email}: ${error.message}`)
    console.log(`  study_members: ${email} → ${studyRole}`)
  }
}

async function discoverCaptureTarget(admin, orgId, studyId) {
  const { data: rows, error } = await admin
    .from('procedure_executions')
    .select(
      `
      id,
      organization_id,
      study_id,
      visit_id,
      source_definition_version_id,
      is_signed,
      is_locked,
      visits(study_subject_id, study_subjects(subject_identifier), visit_definitions(label, code)),
      procedure_definitions(label, code),
      studies(name)
    `,
    )
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .not('source_definition_version_id', 'is', null)
    .eq('is_signed', false)
    .eq('is_locked', false)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) throw error

  const immutableStatuses = new Set([
    'submitted',
    'pending_review',
    'reviewed',
    'signed',
    'locked',
    'corrected',
    'addended',
  ])

  for (const row of rows ?? []) {
    const sdvId = row.source_definition_version_id
    const { count, error: countErr } = await admin
      .from('source_fields')
      .select('id', { count: 'exact', head: true })
      .eq('source_definition_version_id', sdvId)
    if (countErr || (count ?? 0) < 1) continue

    const { data: srs, error: srsErr } = await admin
      .from('source_response_sets')
      .select('id, status')
      .eq('procedure_execution_id', row.id)
      .maybeSingle()
    if (srsErr) throw srsErr
    if (srs && immutableStatuses.has(srs.status)) continue

    return row
  }
  return null
}

async function upsertQaFields(sql, input) {
  await sql`alter table public.source_fields disable trigger source_fields_authoring_gate`

  await sql`
    delete from public.source_fields
    where source_definition_version_id = ${input.sourceDefinitionVersionId}::uuid
      and field_key in (${QA_FIELD_BLINDED}, ${QA_FIELD_UNBLINDED})
  `

  const sortRows = await sql`
    select coalesce(max(sort_order), 0) as max_sort
    from public.source_fields
    where source_definition_version_id = ${input.sourceDefinitionVersionId}::uuid
  `
  const baseSort = Number(sortRows[0]?.max_sort ?? 0)

  const blinded = await sql`
    insert into public.source_fields (
      organization_id,
      study_id,
      source_definition_version_id,
      field_key,
      label,
      instructions,
      sort_order,
      is_required,
      widget_hint,
      blinding_scope
    ) values (
      ${input.organizationId}::uuid,
      ${input.studyId}::uuid,
      ${input.sourceDefinitionVersionId}::uuid,
      ${QA_FIELD_BLINDED},
      'QA Blinded Field',
      'QA capture blinding — visible to blinded coordinators only.',
      ${baseSort + 10},
      false,
      'text',
      'blinded'
    )
    returning id, field_key, blinding_scope
  `

  const unblinded = await sql`
    insert into public.source_fields (
      organization_id,
      study_id,
      source_definition_version_id,
      field_key,
      label,
      instructions,
      sort_order,
      is_required,
      widget_hint,
      blinding_scope
    ) values (
      ${input.organizationId}::uuid,
      ${input.studyId}::uuid,
      ${input.sourceDefinitionVersionId}::uuid,
      ${QA_FIELD_UNBLINDED},
      'QA Unblinded Field',
      'QA capture blinding — requires unblinded site role.',
      ${baseSort + 20},
      false,
      'text',
      'unblinded'
    )
    returning id, field_key, blinding_scope
  `

  await sql`alter table public.source_fields enable trigger source_fields_authoring_gate`

  return {
    blindedFieldId: blinded[0].id,
    unblindedFieldId: unblinded[0].id,
  }
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()
  const dbUrl = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
  if (!dbUrl) throw new Error('Missing DATABASE_URL_DIRECT or DATABASE_URL')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()
  const { data: study, error: studyErr } = await admin
    .from('studies')
    .select('id, organization_id, name, organizations(id, name)')
    .eq('id', studyId)
    .maybeSingle()
  if (studyErr || !study) throw new Error(`Study not found: ${studyId}`)

  const org =
    study.organizations && typeof study.organizations === 'object' && !Array.isArray(study.organizations)
      ? study.organizations
      : { id: study.organization_id, name: study.name }
  assertStagingTarget(org)

  const pe = await discoverCaptureTarget(admin, study.organization_id, study.id)
  if (!pe) {
    throw new Error('No unsigned procedure_execution with source_definition_version found for study')
  }

  const visit = Array.isArray(pe.visits) ? pe.visits[0] : pe.visits
  const subject = visit?.study_subjects
    ? Array.isArray(visit.study_subjects)
      ? visit.study_subjects[0]
      : visit.study_subjects
    : null
  const pd = Array.isArray(pe.procedure_definitions)
    ? pe.procedure_definitions[0]
    : pe.procedure_definitions
  const vd = visit?.visit_definitions
    ? Array.isArray(visit.visit_definitions)
      ? visit.visit_definitions[0]
      : visit.visit_definitions
    : null

  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  const fieldIds = await upsertQaFields(sql, {
    organizationId: study.organization_id,
    studyId: study.id,
    sourceDefinitionVersionId: pe.source_definition_version_id,
  })
  await sql.end({ timeout: 10 })

  const piUserId = await ensurePiUser(admin, study.organization_id)

  const qaUsersByPersona = {
    research_coordinator: 'rbac.qa.research_coordinator@vilo-os.staging',
    data_coordinator: 'rbac.qa.data_coordinator@vilo-os.staging',
    unblinded_coordinator: 'rbac.qa.unblinded.coordinator@vilo-os.staging',
    unblinded_cra: 'rbac.qa.unblinded.cra@vilo-os.staging',
    pi_sub_i: PI_QA_USER.email,
    read_only: 'rbac.qa.read_only@vilo-os.staging',
  }
  await ensureStudyMemberships(admin, study.organization_id, study.id, qaUsersByPersona)

  const { data: sv } = await admin
    .from('source_definition_versions')
    .select('study_version_id')
    .eq('id', pe.source_definition_version_id)
    .maybeSingle()

  const fixture = {
    seededAt: new Date().toISOString(),
    organizationId: study.organization_id,
    organizationName: org.name,
    studyId: study.id,
    studyName: study.name,
    studyVersionId: sv?.study_version_id ?? null,
    studySubjectId: visit?.study_subject_id ?? null,
    visitId: pe.visit_id,
    procedureExecutionId: pe.id,
    sourceDefinitionVersionId: pe.source_definition_version_id,
    procedureLabel: pd?.label ?? pd?.code ?? 'Procedure',
    visitLabel: vd?.label ?? vd?.code ?? 'Visit',
    subjectLabel: subject?.subject_identifier ?? 'Subject',
    fields: {
      qa_blinded_field: {
        id: fieldIds.blindedFieldId,
        fieldKey: QA_FIELD_BLINDED,
        blindingScope: 'blinded',
      },
      qa_unblinded_field: {
        id: fieldIds.unblindedFieldId,
        fieldKey: QA_FIELD_UNBLINDED,
        blindingScope: 'unblinded',
      },
    },
    capturePath: `/source/capture/${pe.id}`,
    qaPassword: QA_PASSWORD,
    piSubIUserId: piUserId,
    qaUsers: qaUsersByPersona,
  }

  mkdirSync(join(dirname(FIXTURE_PATH)), { recursive: true })
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))

  console.log('--- Source capture blinding QA seed complete ---')
  console.log(JSON.stringify(fixture, null, 2))
  console.log(`\nFixture: ${FIXTURE_PATH}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
