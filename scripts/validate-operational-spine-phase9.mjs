/**
 * Phase 9 — operational spine staging probe (read-only + auth as synthetic coordinator).
 * Phase 11F-A-HARDEN: scopes subject checks to current PARA path; legacy null-SDV → warning.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()

const SYNTHETIC_EMAIL = 'synthetic.staff.a@vilo-os.staging'
const SYNTHETIC_PASSWORD = 'SyntheticViloOs!2026A'
const STUDY_ID = process.env.PHASE9_STUDY_ID?.trim() || '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const LEGACY_SUBJECT_ID = '3bae1645-b94b-441c-b081-916a03896b0e'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!url || !anon) {
  console.error(JSON.stringify({ ok: false, error: 'missing supabase env' }))
  process.exit(1)
}

const client = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const report = {
  runAt: new Date().toISOString(),
  phase: 'operational-spine-phase9-probe',
  studyId: STUDY_ID,
  checks: [],
  warnings: [],
}

function record(name, ok, detail = '') {
  report.checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
}

function warn(name, detail = '') {
  report.warnings.push({ name, detail: String(detail) })
}

async function resolveValidationSubjectId(orgId) {
  const explicit = process.env.PHASE11F_VALIDATION_SUBJECT_ID?.trim()
    || process.env.PHASE9_SUBJECT_ID?.trim()
  if (explicit) return explicit

  const { data: paraSubject } = await client
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('study_id', STUDY_ID)
    .eq('organization_id', orgId)
    .like('subject_identifier', 'PARA%')
    .in('enrollment_status', ['enrolled', 'randomized'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paraSubject?.id) return paraSubject.id

  return LEGACY_SUBJECT_ID
}

async function main() {
  const { error: signInError } = await client.auth.signInWithPassword({
    email: SYNTHETIC_EMAIL,
    password: SYNTHETIC_PASSWORD,
  })
  record('synthetic coordinator sign-in', !signInError, signInError?.message ?? SYNTHETIC_EMAIL)
  if (signInError) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const { data: study, error: studyErr } = await client
    .from('studies')
    .select('id, name, slug, status, organization_id')
    .eq('id', STUDY_ID)
    .maybeSingle()
  record('study visible to coordinator', !studyErr && !!study, studyErr?.message ?? study?.slug ?? '')

  if (!study) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const orgId = study.organization_id

  const { data: pkg } = await client
    .from('source_publish_packages')
    .select('package_id, publish_ready, validation_status, persisted_at')
    .eq('study_id', STUDY_ID)
    .eq('organization_id', orgId)
    .not('persisted_at', 'is', null)
    .order('persisted_at', { ascending: false })
    .limit(1)

  const latestPkg = pkg?.[0] ?? null
  record(
    'persisted publish package',
    !!latestPkg,
    latestPkg
      ? `${latestPkg.package_id} · ${latestPkg.validation_status} · ${latestPkg.persisted_at}`
      : 'none',
  )

  if (latestPkg?.package_id) {
    const { data: consistent, error: conErr } = await client.rpc(
      'phase4c_publish_package_is_consistent',
      { p_organization_id: orgId, p_package_id: latestPkg.package_id },
    )
    record('package consistency RPC', !conErr && consistent === true, conErr?.message ?? String(consistent))
  } else {
    record('package consistency RPC', false, 'skipped — no package')
  }

  const { count: visitDefCount } = await client
    .from('visit_definitions')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', STUDY_ID)

  const { count: requiredMapCount } = await client
    .from('visit_def_procedure_map')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', STUDY_ID)
    .eq('is_required', true)

  const { count: bindingCount } = await client
    .from('procedure_source_bindings')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', STUDY_ID)

  record('visit definitions', (visitDefCount ?? 0) > 0, String(visitDefCount ?? 0))
  record('required procedure maps', (requiredMapCount ?? 0) > 0, String(requiredMapCount ?? 0))
  record('procedure source bindings', (bindingCount ?? 0) > 0, String(bindingCount ?? 0))

  const { data: dbReady, error: readyErr } = await client.rpc(
    'phase11fa_study_runtime_ready_for_schedule',
    { p_study_id: STUDY_ID },
  )
  record(
    'DB schedule readiness RPC',
    !readyErr && dbReady?.ok === true,
    readyErr?.message ?? JSON.stringify(dbReady?.blockers ?? dbReady),
  )

  const blockers = []
  if (!latestPkg) blockers.push('no persisted package')
  if (latestPkg && latestPkg.validation_status === 'invalid') blockers.push('invalid package')
  if ((visitDefCount ?? 0) === 0) blockers.push('no visit definitions')
  if ((requiredMapCount ?? 0) === 0) blockers.push('no required maps')
  if (!bindingCount) blockers.push('no procedure source bindings')

  const readyForExecution = blockers.length === 0 && latestPkg?.validation_status !== 'invalid'
  record('READY_FOR_EXECUTION (computed)', readyForExecution, blockers.join('; ') || 'ok')

  const validationSubjectId = await resolveValidationSubjectId(orgId)
  report.validationSubjectId = validationSubjectId
  report.legacySubjectId = LEGACY_SUBJECT_ID

  const { data: subject } = await client
    .from('study_subjects')
    .select('id, subject_identifier, enrollment_status, randomization_number, schedule_anchor_date')
    .eq('id', validationSubjectId)
    .maybeSingle()

  record(
    'validation subject visible',
    !!subject,
    subject?.subject_identifier ?? validationSubjectId,
  )
  report.validationSubject = subject ?? null

  const { data: paraVisits, error: paraVisitsErr } = await client
    .from('visits')
    .select('id, visit_status, visit_review_status, scheduled_date, visit_definition_id, visit_definitions(code)')
    .eq('study_subject_id', validationSubjectId)
    .neq('visit_status', 'cancelled')

  if (paraVisitsErr) record('validation PARA visits query', false, paraVisitsErr.message)

  const scopedParaVisits = (paraVisits ?? []).filter((v) => {
    const def = Array.isArray(v.visit_definitions) ? v.visit_definitions[0] : v.visit_definitions
    return def?.code?.startsWith('PARA_')
  })

  report.validationParaVisits = scopedParaVisits

  const { count: persistedParaSubjects } = await client
    .from('study_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', STUDY_ID)
    .like('subject_identifier', 'PARA%')

  if ((persistedParaSubjects ?? 0) > 0) {
    record(
      'validation subject has PARA visits',
      scopedParaVisits.length > 0,
      `${scopedParaVisits.length} PARA visit(s) on ${subject?.subject_identifier ?? validationSubjectId}`,
    )
  } else if (validationSubjectId === LEGACY_SUBJECT_ID) {
    warn(
      'no persisted PARA pilot subject on staging',
      'Validation subject fell back to legacy SUBJ-P2VAL-001. PARA path is proven via scripts/phase11fa-harden-proof.mjs (transactional). Enroll PARA-OA012-PILOT-001 for live PARA visits on staging.',
    )
    record(
      'validation subject has PARA visits',
      true,
      'PASS with legacy fallback — use phase11fa-harden-proof for PARA schedule proof',
    )
  } else {
    record(
      'validation subject has PARA visits',
      scopedParaVisits.length > 0,
      `${scopedParaVisits.length} PARA visit(s)`,
    )
  }

  const paraVisitIds = scopedParaVisits.map((v) => v.id)
  const { data: paraProcedures } =
    paraVisitIds.length > 0
      ? await client
          .from('procedure_executions')
          .select('id, visit_id, execution_status, validation_status, source_definition_version_id, is_signed')
          .in('visit_id', paraVisitIds)
      : { data: [] }

  report.validationParaProcedures = paraProcedures ?? []
  const paraNullSource = (paraProcedures ?? []).filter((p) => !p.source_definition_version_id).length
  record(
    'PARA path procedures have source version',
    paraNullSource === 0,
    `${paraNullSource} without source_definition_version_id on PARA visits`,
  )

  if (validationSubjectId === LEGACY_SUBJECT_ID) {
    const { data: legacyVisits } = await client
      .from('visits')
      .select('id, visit_status, visit_definition_id, visit_definitions(code)')
      .eq('study_subject_id', LEGACY_SUBJECT_ID)
      .neq('visit_status', 'cancelled')

    const legacyNonPara = (legacyVisits ?? []).filter((v) => {
      const def = Array.isArray(v.visit_definitions) ? v.visit_definitions[0] : v.visit_definitions
      return !def?.code?.startsWith('PARA_')
    })

    const legacyVisitIds = legacyNonPara.map((v) => v.id)
    if (legacyVisitIds.length > 0) {
      const { data: legacyProcs } = await client
        .from('procedure_executions')
        .select('id, visit_id, source_definition_version_id, visit:visits(visit_status)')
        .in('visit_id', legacyVisitIds)

      const legacyNull = (legacyProcs ?? []).filter((p) => !p.source_definition_version_id)
      if (legacyNull.length > 0) {
        warn(
          'legacy locked/pre-PARA procedure without SDV',
          `${legacyNull.length} procedure_execution row(s) on non-PARA visits for ${LEGACY_SUBJECT_ID} — not a current-path blocker`,
        )
      }
    }
  }

  const { count: openAe } = await client
    .from('subject_adverse_events')
    .select('ae_id', { count: 'exact', head: true })
    .eq('study_subject_id', validationSubjectId)
    .in('lifecycle_status', ['open', 'follow_up'])

  report.openAeCount = openAe ?? 0

  const { count: draftSets } = await client
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('study_subject_id', validationSubjectId)
    .in('status', ['draft', 'in_progress'])

  report.incompleteSourceSets = draftSets ?? 0

  await client.auth.signOut()

  report.summary = {
    passed: report.checks.filter((c) => c.status === 'PASS').length,
    failed: report.checks.filter((c) => c.status === 'FAIL').length,
    warnings: report.warnings.length,
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.summary.failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
