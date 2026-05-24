/**
 * Phase 15B — capture route + save/submit using research-coordinator RBAC.
 * Run: npx tsx scripts/phase15b-capture-proof.ts
 */
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { verifyPilotProcedureLinkage } from '../lib/runtime-validation/verify-pilot-procedure-linkage'

const ORG = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const STUDY = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const SUBJECT = '4384b789-4e16-4512-b3f3-50642b3b9735'
const VISIT = '6690da63-4bf1-4681-815a-3e39b7b014bc'
const CAPTURE_USER = {
  email: process.env.RBAC_QA_RESEARCH_COORDINATOR_EMAIL?.trim() ?? 'rbac.qa.research_coordinator@vilo-os.staging',
  password: process.env.RBAC_QA_RESEARCH_COORDINATOR_PASSWORD?.trim() ?? 'RbacBlindingQa!2026',
}
const base = process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000'

async function main() {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const linkage = await verifyPilotProcedureLinkage({
    supabase: admin,
    organizationId: ORG,
    studyId: STUDY,
    visitId: VISIT,
    studySubjectId: SUBJECT,
  })

  console.log('linkage', JSON.stringify(linkage, null, 2))

  if (!linkage.procedureExecutionId || !linkage.capturePath) {
    console.error('FAIL: no capture route')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  const sql = postgres(dbUrl!, {
    ssl: 'require',
    max: 1,
    prepare: dbUrl!.includes('pooler') ? false : undefined,
  })

  const sdvId = linkage.peSourceDefinitionVersionId!
  const fieldRows = await sql`
    select field_key, id from source_fields
    where source_definition_version_id = ${sdvId}::uuid
      and field_key in (
        'heart_rate','temperature','systolic_bp','diastolic_bp',
        'ae_present','epro_completed','ip_administered','external_epro_id','completion_status','ae_term'
      )`
  const byKey = Object.fromEntries(fieldRows.map((r) => [r.field_key as string, r.id as string]))

  const { signInForCookieHeader, apiFetch } = await import('./lib/source-api-e2e.mjs')
  const { cookieHeader } = await signInForCookieHeader(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    CAPTURE_USER,
  )

  const { data: peCtx } = await admin
    .from('procedure_executions')
    .select('visit_id, visits(study_subject_id, study_id)')
    .eq('id', linkage.procedureExecutionId)
    .maybeSingle()
  const visitRow = Array.isArray(peCtx?.visits) ? peCtx?.visits[0] : peCtx?.visits
  const studyVersion = await sql`
    select study_version_id as id from source_definition_versions
    where id = ${sdvId}::uuid
    limit 1`
  const studyVersionId =
    (studyVersion[0]?.id as string | undefined) ??
    (
      await sql`
        select id from study_versions where study_id = ${STUDY}::uuid
        order by created_at desc limit 1`
    )[0]?.id

  const open = await apiFetch(base, '/api/source/response-set/open', {
    method: 'POST',
    cookieHeader,
    timeoutMs: 120_000,
    body: {
      organization_id: ORG,
      study_id: STUDY,
      study_version_id: studyVersionId,
      study_subject_id: (visitRow as { study_subject_id?: string })?.study_subject_id ?? SUBJECT,
      visit_id: peCtx?.visit_id ?? VISIT,
      procedure_execution_id: linkage.procedureExecutionId,
      source_definition_version_id: sdvId,
    },
  })
  console.log('open', open.httpStatus, open.json?.ok, open.json?.code)
  const responseSetId =
    (open.json?.data as { source_response_set_id?: string; id?: string } | undefined)
      ?.source_response_set_id ?? (open.json?.data as { id?: string } | undefined)?.id
  if (!responseSetId) {
    console.error('FAIL: no response set from open', open.json)
    await sql.end()
    process.exit(1)
  }

  const responses = [
    { source_field_id: byKey.heart_rate, value_number: 73 },
    { source_field_id: byKey.temperature, value_number: 98.5 },
    { source_field_id: byKey.systolic_bp, value_number: 119 },
    { source_field_id: byKey.diastolic_bp, value_number: 79 },
    { source_field_id: byKey.ae_present, value_boolean: false },
    { source_field_id: byKey.epro_completed, value_boolean: true },
    { source_field_id: byKey.ip_administered, value_boolean: false },
    { source_field_id: byKey.external_epro_id, value_text: 'EPRO-PHASE15B' },
    { source_field_id: byKey.completion_status, value_text: 'completed' },
    { source_field_id: byKey.ae_term, value_text: 'Phase 15B linkage proof' },
  ].filter((r) => r.source_field_id)

  const save = await apiFetch(base, '/api/source/response-set/save-draft', {
    method: 'POST',
    cookieHeader,
    timeoutMs: 120_000,
    body: {
      organization_id: ORG,
      source_response_set_id: responseSetId,
      responses,
    },
  })
  console.log('save-draft', save.httpStatus, save.json?.ok, save.json?.code)

  const submit = await apiFetch(base, '/api/source/response-set/submit', {
    method: 'POST',
    cookieHeader,
    timeoutMs: 120_000,
    body: {
      organization_id: ORG,
      source_response_set_id: responseSetId,
      submit_reason: 'Phase 15B capture linkage proof',
    },
  })
  console.log('submit', submit.httpStatus, submit.json?.ok, submit.json?.code)

  const rs = await sql`
    select status, submitted_at from source_response_sets where id = ${responseSetId}::uuid`
  console.log('response_set', rs[0])
  console.log('capture_path', linkage.capturePath)

  const saveOk = save.json?.ok === true || save.json?.code === 'SUBMITTED_VALUE_IMMUTABLE'
  const submitOk = submit.json?.ok === true
  await sql.end()
  process.exit(open.json?.ok && saveOk && submitOk ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
