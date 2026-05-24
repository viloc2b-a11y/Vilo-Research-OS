/**
 * Phase 15C — pilot coordinator (calendar.qa) open/save/submit via user-scoped API.
 */
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { verifyPilotCoordinatorCaptureAccess } from '../lib/runtime-validation/verify-pilot-coordinator-capture-access'
import { verifyPilotProcedureLinkage } from '../lib/runtime-validation/verify-pilot-procedure-linkage'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'

const FIXTURE = PILOT_FIXTURE_DEFAULTS
const COORDINATOR = {
  email: process.env.CALENDAR_QA_COORDINATOR_EMAIL?.trim() ?? 'calendar.qa.coordinator@vilo-os.staging',
  password: process.env.CALENDAR_QA_COORDINATOR_PASSWORD?.trim() ?? 'CalendarQaCoordinator!2026',
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

  const access = await verifyPilotCoordinatorCaptureAccess({
    supabase: admin,
    organizationId: FIXTURE.organizationId,
    studyId: FIXTURE.studyId,
    coordinatorUserId: FIXTURE.coordinatorActorUserId,
    coordinatorEmail: COORDINATOR.email,
  })
  const linkage = await verifyPilotProcedureLinkage({
    supabase: admin,
    organizationId: FIXTURE.organizationId,
    studyId: FIXTURE.studyId,
    visitId: FIXTURE.visitId,
    studySubjectId: FIXTURE.studySubjectId,
  })

  console.log('access', JSON.stringify(access, null, 2))
  console.log('linkage', JSON.stringify(linkage, null, 2))
  if (!access.ok || !linkage.procedureExecutionId) process.exit(1)

  const peSdv = linkage.peSourceDefinitionVersionId!
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  const sql = postgres(dbUrl!, {
    ssl: 'require',
    max: 1,
    prepare: dbUrl!.includes('pooler') ? false : undefined,
  })
  const studyVersion = await sql`
    select study_version_id as id from source_definition_versions where id = ${peSdv}::uuid`
  const fieldRows = await sql`
    select field_key, id from source_fields where source_definition_version_id = ${peSdv}::uuid
      and field_key in ('heart_rate','temperature','systolic_bp','diastolic_bp','ae_present','epro_completed','ip_administered','external_epro_id','completion_status','ae_term')`
  const byKey = Object.fromEntries(fieldRows.map((r) => [r.field_key as string, r.id as string]))

  const { signInForCookieHeader, apiFetch } = await import('./lib/source-api-e2e.mjs')
  const { cookieHeader } = await signInForCookieHeader(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COORDINATOR,
  )

  const open = await apiFetch(base, '/api/source/response-set/open', {
    method: 'POST',
    cookieHeader,
    timeoutMs: 120_000,
    body: {
      organization_id: FIXTURE.organizationId,
      study_id: FIXTURE.studyId,
      study_version_id: studyVersion[0]?.id,
      study_subject_id: FIXTURE.studySubjectId,
      visit_id: FIXTURE.visitId,
      procedure_execution_id: linkage.procedureExecutionId,
      source_definition_version_id: peSdv,
    },
  })
  console.log('open', open.httpStatus, open.json?.ok, open.json?.code)

  const responseSetId = (open.json?.data as { source_response_set_id?: string })?.source_response_set_id
  if (!responseSetId) {
    await sql.end()
    process.exit(1)
  }

  const responses = [
    { source_field_id: byKey.heart_rate, value_number: 74 },
    { source_field_id: byKey.temperature, value_number: 98.4 },
    { source_field_id: byKey.systolic_bp, value_number: 118 },
    { source_field_id: byKey.diastolic_bp, value_number: 78 },
    { source_field_id: byKey.ae_present, value_boolean: false },
    { source_field_id: byKey.epro_completed, value_boolean: true },
    { source_field_id: byKey.ip_administered, value_boolean: false },
    { source_field_id: byKey.external_epro_id, value_text: 'EPRO-PHASE15C-PILOT' },
    { source_field_id: byKey.completion_status, value_text: 'completed' },
    { source_field_id: byKey.ae_term, value_text: 'Phase 15C coordinator capture' },
  ].filter((r) => r.source_field_id)

  const save = await apiFetch(base, '/api/source/response-set/save-draft', {
    method: 'POST',
    cookieHeader,
    timeoutMs: 120_000,
    body: {
      organization_id: FIXTURE.organizationId,
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
      organization_id: FIXTURE.organizationId,
      source_response_set_id: responseSetId,
      submit_reason: 'Phase 15C pilot coordinator capture proof',
    },
  })
  console.log('submit', submit.httpStatus, submit.json?.ok, submit.json?.code)

  await sql.end()
  const saveOk = save.json?.ok === true || save.json?.code === 'SUBMITTED_VALUE_IMMUTABLE'
  process.exit(open.json?.ok && saveOk && submit.json?.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
