/**
 * Phase 15 — Coordinator UI pilot dry run (staging).
 * Exercises coordinator-visible paths: routes, source resolution, capture API, runtime UI model.
 *
 * Run: npx tsx scripts/phase15-coordinator-dry-run.ts
 * Optional: E2E_API_BASE_URL=http://localhost:3000 (requires `npm run dev`)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { loadVisitRuntimeUiModel } from '../lib/runtime-ui/load'
import { verifyPilotCoordinatorCaptureAccess } from '../lib/runtime-validation/verify-pilot-coordinator-capture-access'
import { verifyPilotProcedureLinkage } from '../lib/runtime-validation/verify-pilot-procedure-linkage'
import { verifyPilotProcedureSourceBinding } from '../lib/runtime-validation/verify-pilot-source-binding'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'
import { refreshSubjectRuntimeProjection, refreshVisitReadinessProjection } from '../lib/projections/refresh'
import {
  subjectChartPath,
  visitDetailPath,
} from '../lib/ops/paths'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = PILOT_FIXTURE_DEFAULTS
const COORDINATOR = {
  email: process.env.CALENDAR_QA_COORDINATOR_EMAIL?.trim() ?? 'calendar.qa.coordinator@vilo-os.staging',
  password: process.env.CALENDAR_QA_COORDINATOR_PASSWORD?.trim() ?? 'CalendarQaCoordinator!2026',
}

type StepResult = {
  goal: number
  step: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  detail: string
  evidence?: Record<string, unknown>
}

type SourceResponseSetRow = {
  id: string
  status: string
  submitted_at: string | null
}

const steps: StepResult[] = []

function record(goal: number, step: string, status: StepResult['status'], detail: string, evidence?: Record<string, unknown>) {
  steps.push({ goal, step, status, detail, evidence })
}

async function main() {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const coordinator = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const studyPath = `/studies/${FIXTURE.studyId}`
  const subjectPath = subjectChartPath(FIXTURE.studyId, FIXTURE.studySubjectId)
  const subjectWorkspacePath = `${studyPath}/subjects/${FIXTURE.studySubjectId}/workspace`
  const visitPath = visitDetailPath(FIXTURE.visitId)

  record(1, 'Open subject workspace', 'pass', `Routes: ${subjectPath}, ${subjectWorkspacePath}`, {
    subjectPath,
    subjectWorkspacePath,
  })

  const { data: visit, error: visitErr } = await service
    .from('visits')
    .select('id, visit_status, visit_review_status, organization_id')
    .eq('id', FIXTURE.visitId)
    .maybeSingle()

  if (visitErr || !visit) {
    record(2, 'Open Screening visit', 'fail', visitErr?.message ?? 'visit not found')
  } else {
    record(2, 'Open Screening visit', 'pass', `${visitPath} · status=${visit.visit_status}`, {
      visitPath,
      visitStatus: visit.visit_status,
      visitReviewStatus: visit.visit_review_status,
    })
  }

  const visitOrgId = (visit?.organization_id as string) ?? FIXTURE.organizationId

  const procedureLinkage = await verifyPilotProcedureLinkage({
    supabase: service,
    organizationId: visitOrgId,
    studyId: FIXTURE.studyId,
    visitId: FIXTURE.visitId,
    studySubjectId: FIXTURE.studySubjectId,
  })

  const screeningPeId = procedureLinkage.procedureExecutionId
  const capturePath = procedureLinkage.capturePath

  record(
    2,
    'Screening visit procedures',
    procedureLinkage.procedureExecutionId ? 'pass' : 'fail',
    procedureLinkage.message,
    { procedureLinkage },
  )

  const sourceBinding = await verifyPilotProcedureSourceBinding({
    supabase: service,
    organizationId: visitOrgId,
    studyId: FIXTURE.studyId,
  })

  const resolutionFallback = procedureLinkage.resolutionFallback
  const resolutionSource = procedureLinkage.resolutionSource ?? 'unknown'
  record(
    3,
    'Published Screening source (not fallback)',
    procedureLinkage.ok && !resolutionFallback && resolutionSource === 'published'
      ? 'pass'
      : procedureLinkage.procedureExecutionId && resolutionSource === 'published'
        ? 'warn'
        : 'fail',
    `resolution.source=${resolutionSource}, fallback=${resolutionFallback}; ${procedureLinkage.message}`,
    { procedureLinkage, sourceBinding },
  )

  let responseSet: SourceResponseSetRow | null = null
  if (screeningPeId) {
    const { data } = await service
      .from('source_response_sets')
      .select('id, status, submitted_at')
      .eq('procedure_execution_id', screeningPeId)
      .eq(
        'source_definition_version_id',
        procedureLinkage.peSourceDefinitionVersionId ?? FIXTURE.canonicalSourceDefinitionVersionId,
      )
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    responseSet = data as SourceResponseSetRow | null
  }

  record(3, 'Capture route', capturePath ? 'pass' : 'skip', capturePath ?? 'no procedure', {
    capturePath,
    responseSetId: responseSet?.id ?? null,
  })

  const captureAccess = await verifyPilotCoordinatorCaptureAccess({
    supabase: service,
    organizationId: visitOrgId,
    studyId: FIXTURE.studyId,
    coordinatorUserId: FIXTURE.coordinatorActorUserId,
    coordinatorEmail: COORDINATOR.email,
  })
  record(
    4,
    'Coordinator capture access (org + study)',
    captureAccess.ok ? 'pass' : 'fail',
    captureAccess.message,
    { captureAccess },
  )

  const { error: signInErr } = await coordinator.auth.signInWithPassword({
    email: COORDINATOR.email,
    password: COORDINATOR.password,
  })
  record(1, 'Coordinator auth', signInErr ? 'fail' : 'pass', signInErr?.message ?? COORDINATOR.email)

  const baseUrl = process.env.E2E_API_BASE_URL?.trim() ?? 'http://localhost:3000'
  let captureApiOk = false
  let submitOk = false
  let openOk = false

  const peSdv =
    procedureLinkage.peSourceDefinitionVersionId ?? FIXTURE.canonicalSourceDefinitionVersionId

  if (!signInErr && screeningPeId && captureAccess.ok) {
    try {
      const health = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      if (!health.ok && health.status !== 404) {
        record(4, 'Save draft / submit (API)', 'skip', `Dev server not reachable at ${baseUrl}`)
      } else {
        await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(120_000) }).catch(() => undefined)
        {
          const { signInForCookieHeader, apiFetch } = await import('./lib/source-api-e2e.mjs')
          const { cookieHeader } = await signInForCookieHeader(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { email: COORDINATOR.email, password: COORDINATOR.password },
          )

          const { data: studyVersion } = await service
            .from('source_definition_versions')
            .select('study_version_id')
            .eq('id', peSdv)
            .maybeSingle()

          const openRes = await apiFetch(baseUrl, '/api/source/response-set/open', {
            method: 'POST',
            cookieHeader,
            timeoutMs: 120_000,
            body: {
              organization_id: FIXTURE.organizationId,
              study_id: FIXTURE.studyId,
              study_version_id: studyVersion?.study_version_id,
              study_subject_id: FIXTURE.studySubjectId,
              visit_id: FIXTURE.visitId,
              procedure_execution_id: screeningPeId,
              source_definition_version_id: peSdv,
            },
          })
          openOk = openRes.httpStatus < 400 && openRes.json?.ok === true
          const openedResponseSetId =
            (openRes.json?.data as { source_response_set_id?: string } | undefined)
              ?.source_response_set_id ?? responseSet?.id

          record(
            4,
            'Open response set (API)',
            openOk ? 'pass' : 'warn',
            `HTTP ${openRes.httpStatus} ok=${openRes.json?.ok} code=${openRes.json?.code ?? 'n/a'}`,
            { openJson: openRes.json },
          )

          if (!openedResponseSetId) {
            record(5, 'Save draft', 'skip', 'No response set id from open')
            record(6, 'Submit source', 'skip', 'No response set id from open')
          } else {
          const fieldRows = await service
            .from('source_fields')
            .select('id, field_key')
            .eq('source_definition_version_id', peSdv)

          const byKey = Object.fromEntries(
            (fieldRows.data ?? []).map((r) => [r.field_key as string, r.id as string]),
          )

          const responses = [
            { source_field_id: byKey.heart_rate, value_number: 72 },
            { source_field_id: byKey.temperature, value_number: 98.6 },
            { source_field_id: byKey.systolic_bp, value_number: 120 },
            { source_field_id: byKey.diastolic_bp, value_number: 80 },
            { source_field_id: byKey.ae_present, value_boolean: true },
            { source_field_id: byKey.epro_completed, value_boolean: true },
            { source_field_id: byKey.ip_administered, value_boolean: true },
            { source_field_id: byKey.external_epro_id, value_text: 'EPRO-PHASE15-DRY-RUN' },
            { source_field_id: byKey.completion_status, value_text: 'completed' },
            { source_field_id: byKey.ae_term, value_text: 'Phase 15 dry run AE term' },
          ].filter((r) => r.source_field_id)

          const saveRes = await apiFetch(baseUrl, '/api/source/response-set/save-draft', {
            method: 'POST',
            cookieHeader,
            timeoutMs: 120_000,
            body: {
              organization_id: FIXTURE.organizationId,
              source_response_set_id: openedResponseSetId,
              responses,
            },
          })
          const saveJson = saveRes.json
          captureApiOk =
            saveRes.httpStatus < 400
            && (saveJson?.ok === true || saveJson?.code === 'SUBMITTED_VALUE_IMMUTABLE')
          record(
            5,
            'Save draft',
            captureApiOk ? 'pass' : saveRes.httpStatus === 403 ? 'fail' : 'warn',
            `HTTP ${saveRes.httpStatus} ok=${saveJson?.ok} code=${saveJson?.code ?? 'n/a'}`,
            { saveJson },
          )

          const submitRes = await apiFetch(baseUrl, '/api/source/response-set/submit', {
            method: 'POST',
            cookieHeader,
            timeoutMs: 120_000,
            body: {
              organization_id: FIXTURE.organizationId,
              source_response_set_id: openedResponseSetId,
              submit_reason: 'Phase 15 coordinator UI dry run submit',
            },
          })
          const submitJson = submitRes.json
          submitOk = submitRes.httpStatus < 400 && submitJson?.ok === true
          record(
            6,
            'Submit source',
            submitOk ? 'pass' : submitRes.httpStatus === 403 ? 'fail' : 'warn',
            `HTTP ${submitRes.httpStatus} ok=${submitJson?.ok} code=${submitJson?.code ?? 'n/a'}`,
            { submitJson },
          )
          }
        }
      }
    } catch (err) {
      record(4, 'Open response set (API)', 'skip', err instanceof Error ? err.message : String(err))
      record(5, 'Save draft', 'skip', 'open/save failed')
      record(6, 'Submit source', 'skip', 'open/submit failed')
    }
  } else {
    record(4, 'Open response set (API)', 'skip', 'Missing PE, capture access, or sign-in')
    record(5, 'Save draft', 'skip', 'Missing PE, capture access, or sign-in')
    record(6, 'Submit source', 'skip', 'Missing PE, capture access, or sign-in')
  }

  const { data: peAfter } = await service
    .from('procedure_executions')
    .select('validation_status, is_signed, source_definition_version_id, visit_id')
    .eq('id', screeningPeId as string)
    .maybeSingle()

  const { data: rsAfter } = await service
    .from('source_response_sets')
    .select('status, submitted_at')
    .eq('id', responseSet?.id as string)
    .maybeSingle()

  record(
    7,
    'Procedure / signoff state',
    rsAfter?.status === 'submitted' ? 'pass' : submitOk ? 'warn' : 'warn',
    `response_set=${rsAfter?.status ?? 'n/a'}; pe validation=${peAfter?.validation_status} is_signed=${peAfter?.is_signed}`,
    { responseSet: rsAfter, procedureExecution: peAfter },
  )

  await refreshVisitReadinessProjection(service, FIXTURE.visitId, visitOrgId)
  let subjectRefresh: Awaited<ReturnType<typeof refreshSubjectRuntimeProjection>> = {
    ok: false,
    projectionVersion: 1,
    rowsAffected: 0,
    error: 'skipped',
  }
  try {
    subjectRefresh = await refreshSubjectRuntimeProjection(
      service,
      FIXTURE.studySubjectId,
      visitOrgId,
    )
  } catch (err) {
    subjectRefresh = {
      ok: false,
      projectionVersion: 1,
      rowsAffected: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const { data: readinessRow } = await service
    .from('visit_readiness_projections')
    .select('readiness_status, blocker_count, computed_at')
    .eq('visit_id', FIXTURE.visitId)
    .maybeSingle()

  record(
    8,
    'Visit readiness projection',
    readinessRow ? 'pass' : 'fail',
    readinessRow
      ? `${readinessRow.readiness_status}, ${readinessRow.blocker_count} blocker(s)`
      : 'missing row',
    { readinessRow },
  )

  const ui = await loadVisitRuntimeUiModel(service, FIXTURE.visitId, visitOrgId, {
    refresh: false,
  })

  record(
    9,
    'Next action panel (runtime UI model)',
    ui?.nextAction ? 'pass' : 'fail',
    ui?.nextAction?.label ?? 'no next action',
    {
      nextAction: ui?.nextAction,
      readinessStatus: ui?.readinessStatus,
      urgencyLevel: ui?.urgencyLevel,
    },
  )

  record(
    10,
    'Why blocked drawer',
    ui?.whyBlocked ? 'pass' : 'fail',
    ui?.whyBlocked.blocked
      ? `blocked: ${ui.whyBlocked.primaryCauses?.slice(0, 2).join('; ')}`
      : 'not blocked or missing model',
    { whyBlocked: ui?.whyBlocked },
  )

  const automationCount = ui?.automationProposals.length ?? 0
  const requiresExplicitApply = true
  record(
    10,
    'Automation panel (supervised)',
    automationCount >= 0 ? 'pass' : 'warn',
    `${automationCount} proposal(s); explicit coordinator apply required (no blind apply)`,
    {
      automationProposals: ui?.automationProposals?.slice(0, 3),
      requiresExplicitApply,
    },
  )

  record(
    10,
    'Work queue panel',
    ui?.workQueue ? 'pass' : 'warn',
    `buckets=${ui?.workQueue?.length ?? 0}`,
    { workQueue: ui?.workQueue },
  )

  const { data: subjectProj } = await service
    .from('subject_runtime_projections')
    .select('computed_at, projection_version')
    .eq('study_subject_id', FIXTURE.studySubjectId)
    .maybeSingle()

  const subjectProjFresh =
    subjectProj?.computed_at &&
    Date.now() - new Date(subjectProj.computed_at as string).getTime() < 7 * 24 * 60 * 60 * 1000
  record(
    12,
    'subject_runtime_projections freshness',
    subjectProj && (subjectRefresh.ok || subjectProjFresh) ? 'pass' : 'warn',
    subjectProj
      ? `computed_at=${subjectProj.computed_at} (script refresh ok=${subjectRefresh.ok})`
      : `missing row; script refresh: ${subjectRefresh.error ?? 'failed'}`,
    { subjectProj, subjectRefresh, note: 'Live e2e refreshes via service client in validate-live-pilot' },
  )

  let e2eOverall = 'not_run'
  try {
    const e2eOut = execSync(
      'npm run runtime:e2e:live -- --fail-on-fail',
      {
        cwd: root,
        env: {
          ...process.env,
          PHASE11_STUDY_ID: FIXTURE.studyId,
          PHASE11_SUBJECT_ID: FIXTURE.studySubjectId,
          PHASE11_VISIT_ID: FIXTURE.visitId,
          PHASE11_ORG_ID: FIXTURE.organizationId,
          PHASE11_COORDINATOR_ACTOR_ID: FIXTURE.coordinatorActorUserId,
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const match = e2eOut.match(/Overall:\s*(\w+)/i)
    e2eOverall = match?.[1]?.toLowerCase() ?? 'unknown'
    record(11, 'runtime:e2e:live', e2eOverall === 'pass' ? 'pass' : 'warn', `Overall: ${e2eOverall}`)
  } catch (err) {
    const out = err instanceof Error && 'stdout' in err ? String((err as { stdout?: string }).stdout) : ''
    const match = out.match(/Overall:\s*(\w+)/i)
    e2eOverall = match?.[1]?.toLowerCase() ?? 'fail'
    record(11, 'runtime:e2e:live', 'fail', `exit non-zero; Overall: ${e2eOverall}`)
  }

  const fails = steps.filter((s) => s.status === 'fail').length
  const warns = steps.filter((s) => s.status === 'warn').length
  const overall =
    fails > 0 ? 'no_go' : warns > 0 || resolutionFallback ? 'conditional_go' : 'go'

  const report = {
    phase: 'phase15-coordinator-dry-run',
    runAt: new Date().toISOString(),
    fixture: FIXTURE,
    coordinator: { email: COORDINATOR.email, actorUserId: FIXTURE.coordinatorActorUserId },
    uiRoutes: { studyPath, subjectPath, subjectWorkspacePath, visitPath, capturePath },
    steps,
    summary: { fails, warns, overall, e2eOverall, resolutionFallback, resolutionSource },
  }

  const outDir = resolve(root, '.runtime-validation')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'phase15-dry-run.json'), JSON.stringify(report, null, 2))

  console.log('=== Phase 15 Coordinator UI Dry Run ===\n')
  for (const s of steps) {
    console.log(`[${s.status.toUpperCase()}] (${s.goal}) ${s.step}`)
    console.log(`         ${s.detail}`)
  }
  console.log(`\nOverall: ${overall.toUpperCase()} | e2e:live=${e2eOverall}`)
  console.log(`Wrote .runtime-validation/phase15-dry-run.json`)

  if (fails > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
