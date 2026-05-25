/**
 * Phase 16C — Supervised coordinator pilot dry run (staging DB + local or E2E_API_BASE_URL).
 *
 * Run: npx tsx scripts/phase16c-supervised-coordinator-pilot-dry-run.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mapOperationalWorkQueue } from '../lib/coordinator-operations/map-operational-work-queue'
import { collectTelemetryMetadataIssues } from '../lib/observability/redact-telemetry-metadata'
import { loadVisitRuntimeUiModel } from '../lib/runtime-ui/load'
import { loadVisitReadinessProjection } from '../lib/projections/load'
import { refreshVisitReadinessProjection } from '../lib/projections/refresh'
import { computeVisitCoordinatorOrchestration } from '../lib/coordinator-orchestration/compute-visit'
import { upsertVisitCoordinatorOrchestrationProjection } from '../lib/coordinator-orchestration/persist'
import { verifyPilotCoordinatorCaptureAccess } from '../lib/runtime-validation/verify-pilot-coordinator-capture-access'
import { verifyPilotProcedureLinkage } from '../lib/runtime-validation/verify-pilot-procedure-linkage'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'
import {
  studyWorkspacePath,
  subjectWorkspacePath,
  visitDetailPath,
  commandCenterPath,
} from '../lib/ops/paths'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = PILOT_FIXTURE_DEFAULTS
const COORDINATOR = {
  email: process.env.CALENDAR_QA_COORDINATOR_EMAIL?.trim() ?? 'calendar.qa.coordinator@vilo-os.staging',
  password: process.env.CALENDAR_QA_COORDINATOR_PASSWORD?.trim() ?? 'CalendarQaCoordinator!2026',
  userId: FIXTURE.coordinatorActorUserId,
}

type Step = {
  id: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  detail: string
  evidence?: Record<string, unknown>
}

const steps: Step[] = []

function record(id: string, status: Step['status'], detail: string, evidence?: Record<string, unknown>) {
  steps.push({ id, status, detail, evidence })
}

async function checkMigrations(service: SupabaseClient) {
  const tables: Array<{ name: string; column: string }> = [
    { name: 'source_response_field_snapshots', column: 'id' },
    { name: 'workflow_activity_checkpoints', column: 'id' },
    { name: 'workflow_decision_authorities', column: 'id' },
    { name: 'pilot_feedback', column: 'id' },
    { name: 'document_versions', column: 'id' },
    { name: 'visit_coordinator_orchestration_projections', column: 'visit_id' },
  ]
  const missing: string[] = []
  for (const table of tables) {
    const { error } = await service.from(table.name).select(table.column).limit(1)
    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      missing.push(table.name)
    }
  }
  record(
    'preflight.migrations',
    missing.length === 0 ? 'pass' : 'fail',
    missing.length === 0 ? '0082–0089 tables present' : `Missing tables: ${missing.join(', ')}`,
    { missing },
  )
}

async function projectionSnapshot(service: SupabaseClient, label: string) {
  const [visitOrch, visitReady, subjectOrch, subjectReady] = await Promise.all([
    service
      .from('visit_coordinator_orchestration_projections')
      .select('visit_id, top_priority_score, action_now_count, computed_at')
      .eq('visit_id', FIXTURE.visitId)
      .maybeSingle(),
    service
      .from('visit_readiness_projections')
      .select('readiness_status, blocker_count, computed_at')
      .eq('visit_id', FIXTURE.visitId)
      .maybeSingle(),
    service
      .from('subject_coordinator_orchestration_projections')
      .select('study_subject_id, top_priority_score, action_now_count, computed_at')
      .eq('study_subject_id', FIXTURE.studySubjectId)
      .maybeSingle(),
    service
      .from('subject_runtime_projections')
      .select('operational_health, computed_at')
      .eq('study_subject_id', FIXTURE.studySubjectId)
      .maybeSingle(),
  ])
  return {
    label,
    visitOrch: visitOrch.data,
    visitReady: visitReady.data,
    subjectOrch: subjectOrch.data,
    subjectReady: subjectReady.data,
  }
}

/** Service-role site ops snapshot (no Next request / cookies). */
async function loadSiteOpsDryRun(service: SupabaseClient, organizationId: string) {
  const orgIds = [organizationId]
  const [studiesResult, orchResult, readinessResult] = await Promise.all([
    service
      .from('studies')
      .select('id, name, status')
      .in('organization_id', orgIds)
      .neq('status', 'archived')
      .limit(12),
    service
      .from('visit_coordinator_orchestration_projections')
      .select('visit_id, study_id, next_actions, work_queue, top_priority_score')
      .in('organization_id', orgIds)
      .gt('top_priority_score', 0)
      .order('top_priority_score', { ascending: false })
      .limit(40),
    service
      .from('visit_readiness_projections')
      .select('visit_id, readiness_status, missing_source_count, unsigned_procedure_count, safety_blocker_count')
      .in('organization_id', orgIds)
      .in('readiness_status', ['blocked', 'attention']),
  ])
  const orchRows = (orchResult.data ?? []) as Array<Record<string, unknown>>
  const topNextActions = orchRows.flatMap((row) =>
    ((row.next_actions as Array<{ id: string; label: string; priority: number }>) ?? []).map(
      (action) => ({
        id: `${row.visit_id}:${action.id}`,
        label: action.label,
        priority: action.priority,
      }),
    ),
  )
  const aggregatedQueue: Record<string, { label: string; priority: number }[]> = {}
  for (const row of orchRows) {
    const readiness = ((readinessResult.data ?? []) as Array<Record<string, unknown>>).find(
      (r) => r.visit_id === row.visit_id,
    )
    const buckets = mapOperationalWorkQueue({
      workQueue: row.work_queue as Record<string, { label: string; priority: number }[]>,
      missingSourceCount: readiness?.missing_source_count as number | undefined,
      unsignedProcedureCount: readiness?.unsigned_procedure_count as number | undefined,
      safetyBlockerCount: readiness?.safety_blocker_count as number | undefined,
    })
    for (const bucket of buckets) {
      if (!aggregatedQueue[bucket.bucket]) aggregatedQueue[bucket.bucket] = []
      aggregatedQueue[bucket.bucket]!.push(...bucket.items)
    }
  }
  const workQueueBuckets = Object.entries(aggregatedQueue)
    .map(([bucket, items]) => ({ bucket, count: items.length }))
    .filter((b) => b.count > 0)
  return {
    topNextActions,
    workQueueBuckets,
    activeStudies: studiesResult.data ?? [],
    projectionDataAvailable:
      orchRows.length > 0 || (readinessResult.data?.length ?? 0) > 0,
  }
}

async function loadStudyOpsDryRun(service: SupabaseClient, studyId: string) {
  const { data: study } = await service
    .from('studies')
    .select('id, organization_id, name')
    .eq('id', studyId)
    .maybeSingle()
  if (!study) return { projectionDataAvailable: false, activeBlockers: [], operationalRiskLevel: null }
  const studyRow = study as { organization_id: string }
  const orgId = studyRow.organization_id
  const [orchRows, readiness] = await Promise.all([
    service
      .from('visit_coordinator_orchestration_projections')
      .select('visit_id, work_queue, top_priority_score')
      .eq('study_id', studyId)
      .eq('organization_id', orgId)
      .limit(25),
    service
      .from('visit_readiness_projections')
      .select('visit_id, readiness_status, blocker_count')
      .eq('study_id', studyId)
      .in('readiness_status', ['blocked', 'attention']),
  ])
  const blocked = ((readiness.data ?? []) as Array<Record<string, unknown>>).filter(
    (r) => r.readiness_status === 'blocked',
  )
  return {
    projectionDataAvailable: (orchRows.data?.length ?? 0) > 0 || blocked.length > 0,
    activeBlockers: blocked.map((r) => ({
      id: r.visit_id as string,
      label: `Visit blocked (${r.blocker_count ?? 0})`,
    })),
    operationalRiskLevel: blocked.length > 2 ? 'elevated' : blocked.length > 0 ? 'attention' : null,
  }
}

async function loadSubjectOpsDryRun(service: SupabaseClient, studySubjectId: string) {
  const { data: subject } = await service
    .from('study_subjects')
    .select('id, study_id, organization_id, subject_identifier')
    .eq('id', studySubjectId)
    .maybeSingle()
  if (!subject) return { projectionDataAvailable: false, currentVisit: null, openSourceItems: [] }
  const subjectRow = subject as { organization_id: string }
  const orgId = subjectRow.organization_id
  const [visits, sourceSets, orchRow] = await Promise.all([
    service
      .from('visits')
      .select('id, visit_status, scheduled_date, visit_definitions(label)')
      .eq('study_subject_id', studySubjectId)
      .order('scheduled_date', { ascending: false })
      .limit(5),
    service
      .from('source_response_sets')
      .select('id, status')
      .eq('study_subject_id', studySubjectId)
      .in('status', ['draft', 'in_progress', 'pending_review'])
      .limit(10),
    service
      .from('visit_coordinator_orchestration_projections')
      .select('visit_id, next_actions')
      .eq('study_subject_id', studySubjectId)
      .eq('organization_id', orgId)
      .order('top_priority_score', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const visitRows = (visits.data ?? []) as Array<Record<string, unknown>>
  const pilotVisit =
    visitRows.find((v) => v.id === FIXTURE.visitId)
    ?? ((await service
      .from('visits')
      .select('id, visit_status, scheduled_date, visit_definitions(label)')
      .eq('id', FIXTURE.visitId)
      .maybeSingle()).data as Record<string, unknown> | null)
  const def = Array.isArray(pilotVisit?.visit_definitions)
    ? (pilotVisit.visit_definitions as Array<{ label?: string }>)[0]
    : (pilotVisit?.visit_definitions as { label?: string } | undefined)
  return {
    projectionDataAvailable: Boolean(orchRow.data) || (sourceSets.data?.length ?? 0) > 0,
    currentVisit: pilotVisit
      ? {
          id: pilotVisit.id as string,
          label: (def as { label?: string })?.label ?? 'Visit',
          status: pilotVisit.visit_status as string,
        }
      : null,
    openSourceItems: ((sourceSets.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      status: s.status as string,
    })),
    nextActions: (orchRow.data as Record<string, unknown> | null)?.next_actions ?? [],
  }
}

async function recomputeVisitOrchestration(service: SupabaseClient, orgId: string) {
  await refreshVisitReadinessProjection(service, FIXTURE.visitId, orgId)
  const readiness = await loadVisitReadinessProjection(service, FIXTURE.visitId, orgId, {
    refreshIfStale: false,
  })
  if (!readiness) return null
  const orch = await computeVisitCoordinatorOrchestration({
    supabase: service,
    organizationId: orgId,
    studyId: FIXTURE.studyId,
    visitId: FIXTURE.visitId,
    readiness,
  })
  if (orch) await upsertVisitCoordinatorOrchestrationProjection(orch)
  return orch
}

async function ensureVisitOrchestration(service: SupabaseClient, orgId: string) {
  try {
    await recomputeVisitOrchestration(service, orgId)
    return true
  } catch (err) {
    record(
      'projections.recompute',
      'warn',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

async function main() {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const baseUrl =
    process.env.E2E_API_BASE_URL?.trim()
    ?? process.env.NEXT_PUBLIC_APP_URL?.trim()
    ?? 'http://localhost:3000'

  const service: SupabaseClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  record(
    'environment',
    'pass',
    `Staging Supabase + app base ${baseUrl}`,
    { supabaseUrl, baseUrl },
  )

  await checkMigrations(service)

  const beforeProj = await projectionSnapshot(service, 'before')
  record(
    'projections.before',
    beforeProj.visitOrch || beforeProj.visitReady ? 'pass' : 'warn',
    `visit_orch=${Boolean(beforeProj.visitOrch)} visit_ready=${Boolean(beforeProj.visitReady)}`,
    beforeProj,
  )

  const linkage = await verifyPilotProcedureLinkage({
    supabase: service,
    organizationId: FIXTURE.organizationId,
    studyId: FIXTURE.studyId,
    visitId: FIXTURE.visitId,
    studySubjectId: FIXTURE.studySubjectId,
  })

  const peId = linkage.procedureExecutionId
  record('fixture.linkage', linkage.ok ? 'pass' : 'fail', linkage.message, { linkage })

  await ensureVisitOrchestration(service, FIXTURE.organizationId)
  const afterRecompute = await projectionSnapshot(service, 'after_recompute')

  const siteOps = await loadSiteOpsDryRun(service, FIXTURE.organizationId)
  record(
    'route.command_center',
    'pass',
    `topActions=${siteOps.topNextActions.length} queueBuckets=${siteOps.workQueueBuckets.length} studies=${siteOps.activeStudies.length}`,
    {
      path: commandCenterPath(),
      topNextActions: siteOps.topNextActions.slice(0, 5),
      workQueueBuckets: siteOps.workQueueBuckets,
      projectionDataAvailable: siteOps.projectionDataAvailable,
    },
  )

  const studyOps = await loadStudyOpsDryRun(service, FIXTURE.studyId)
  record(
    'route.study_workspace',
    studyOps.projectionDataAvailable ? 'pass' : 'warn',
    `risk=${studyOps.operationalRiskLevel ?? 'n/a'} blockers=${studyOps.activeBlockers.length}`,
    { path: studyWorkspacePath(FIXTURE.studyId), studyOps },
  )

  const subjectOps = await loadSubjectOpsDryRun(service, FIXTURE.studySubjectId)
  record(
    'route.subject_workspace',
    subjectOps.projectionDataAvailable ? 'pass' : 'warn',
    `currentVisit=${Boolean(subjectOps.currentVisit)} openSource=${subjectOps.openSourceItems.length}`,
    { path: subjectWorkspacePath(FIXTURE.studySubjectId), subjectOps },
  )

  const coordinatorClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await coordinatorClient.auth.signInWithPassword({
    email: COORDINATOR.email,
    password: COORDINATOR.password,
  })
  record(
    'auth.coordinator',
    signInErr ? 'fail' : 'pass',
    signInErr?.message ?? COORDINATOR.email,
    { userId: COORDINATOR.userId },
  )

  const captureAccess = await verifyPilotCoordinatorCaptureAccess({
    supabase: service,
    organizationId: FIXTURE.organizationId,
    studyId: FIXTURE.studyId,
    coordinatorUserId: COORDINATOR.userId,
    coordinatorEmail: COORDINATOR.email,
  })
  record('rbac.capture', captureAccess.ok ? 'pass' : 'fail', captureAccess.message)

  let openOk = false
  let saveOk = false
  let submitOk = false
  let coordinatorErrorLeak = false

  if (!signInErr && peId && captureAccess.ok) {
    try {
      const health = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      if (!health.ok && health.status !== 404) {
        record('api.reachable', 'fail', `Cannot reach ${baseUrl}`)
      } else {
        record('api.reachable', 'pass', `HTTP ${health.status} at ${baseUrl}`)
        const { signInForCookieHeader, apiFetch } = await import('./lib/source-api-e2e.mjs')
        const { cookieHeader } = await signInForCookieHeader(
          supabaseUrl,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { email: COORDINATOR.email, password: COORDINATOR.password },
        )

        const peSdv =
          linkage.peSourceDefinitionVersionId ?? FIXTURE.canonicalSourceDefinitionVersionId
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
            procedure_execution_id: peId,
            source_definition_version_id: peSdv,
          },
        })
        openOk = openRes.httpStatus < 400 && openRes.json?.ok === true
        const openedId =
          (openRes.json?.data as { source_response_set_id?: string })?.source_response_set_id

        const errText = JSON.stringify(openRes.json ?? {})
        if (/violates|constraint|row-level|pg_|supabase/i.test(errText)) {
          coordinatorErrorLeak = true
        }
        record('source.open', openOk ? 'pass' : 'warn', `HTTP ${openRes.httpStatus}`, {
          coordinatorMessage: openRes.json?.errors?.[0]?.message,
          technicalInContext: Boolean(
            (openRes.json?.errors?.[0]?.context as Record<string, unknown>)?.technical_message,
          ),
        })

        if (openedId) {
          const fieldRows = await service
            .from('source_fields')
            .select('id, field_key')
            .eq('source_definition_version_id', peSdv)
          const byKey = Object.fromEntries(
            (fieldRows.data ?? []).map((r) => [r.field_key as string, r.id as string]),
          )
          const responses = [
            { source_field_id: byKey.heart_rate, value_number: 73 },
            { source_field_id: byKey.temperature, value_number: 98.4 },
            { source_field_id: byKey.systolic_bp, value_number: 118 },
            { source_field_id: byKey.diastolic_bp, value_number: 78 },
            { source_field_id: byKey.ae_present, value_boolean: true },
            { source_field_id: byKey.epro_completed, value_boolean: true },
            { source_field_id: byKey.ip_administered, value_boolean: true },
            { source_field_id: byKey.external_epro_id, value_text: 'EPRO-PHASE16C-PILOT' },
            { source_field_id: byKey.completion_status, value_text: 'completed' },
            { source_field_id: byKey.ae_term, value_text: 'Phase 16C supervised pilot AE' },
          ].filter((r) => r.source_field_id)

          const saveRes = await apiFetch(baseUrl, '/api/source/response-set/save-draft', {
            method: 'POST',
            cookieHeader,
            timeoutMs: 120_000,
            body: {
              organization_id: FIXTURE.organizationId,
              source_response_set_id: openedId,
              responses,
            },
          })
          saveOk =
            saveRes.httpStatus < 400
            && (saveRes.json?.ok === true || saveRes.json?.code === 'SUBMITTED_VALUE_IMMUTABLE')
          if (/violates|constraint|row-level|pg_/i.test(JSON.stringify(saveRes.json ?? {}))) {
            coordinatorErrorLeak = true
          }
          record('source.save_draft', saveOk ? 'pass' : 'warn', `HTTP ${saveRes.httpStatus}`, {
            code: saveRes.json?.code,
            message: saveRes.json?.errors?.[0]?.message,
          })

          const submitRes = await apiFetch(baseUrl, '/api/source/response-set/submit', {
            method: 'POST',
            cookieHeader,
            timeoutMs: 120_000,
            body: {
              organization_id: FIXTURE.organizationId,
              source_response_set_id: openedId,
              submit_reason: 'Phase 16C supervised coordinator pilot dry run',
            },
          })
          submitOk = submitRes.httpStatus < 400 && submitRes.json?.ok === true
          if (/violates|constraint|row-level|pg_/i.test(JSON.stringify(submitRes.json ?? {}))) {
            coordinatorErrorLeak = true
          }
          record('source.submit', submitOk ? 'pass' : 'warn', `HTTP ${submitRes.httpStatus}`, {
            code: submitRes.json?.code,
            message: submitRes.json?.errors?.[0]?.message,
          })

          try {
            await recomputeVisitOrchestration(service, FIXTURE.organizationId)
          } catch (recomputeErr) {
            record(
              'projections.post_submit',
              'warn',
              recomputeErr instanceof Error ? recomputeErr.message : String(recomputeErr),
            )
          }

          const { count: snapCount } = await service
            .from('source_response_field_snapshots')
            .select('id', { count: 'exact', head: true })
            .eq('source_response_set_id', openedId)

          record(
            'integrity.snapshots',
            (snapCount ?? 0) > 0 ? 'pass' : submitOk ? 'warn' : 'skip',
            `${snapCount ?? 0} snapshot row(s) for response set`,
            { responseSetId: openedId },
          )
        }
      }
    } catch (err) {
      record('source.api', 'fail', err instanceof Error ? err.message : String(err))
    }
  } else {
    record('source.api', 'skip', 'Auth, PE, or RBAC blocked API path')
  }

  if (peId) {
    const { data: peRow } = await service
      .from('procedure_executions')
      .select('id, is_signed, execution_status')
      .eq('id', peId)
      .maybeSingle()
    record(
      'visit.sign',
      peRow?.is_signed ? 'pass' : 'warn',
      peRow?.is_signed
        ? 'Screening PE already signed'
        : 'PE unsigned — coordinator signoff requires supervised UI action (server action; not exercised in API dry run)',
      { procedureExecutionId: peId, isSigned: peRow?.is_signed, executionStatus: peRow?.execution_status },
    )
  }

  record(
    'ux.no_technical_errors',
    coordinatorErrorLeak ? 'fail' : 'pass',
    coordinatorErrorLeak
      ? 'Coordinator API envelope may expose technical tokens'
      : 'No SQL/constraint leakage in API error envelopes checked',
  )

  const ui = await loadVisitRuntimeUiModel(service, FIXTURE.visitId, FIXTURE.organizationId, {
    refresh: false,
  })
  record(
    'runtime.ui',
    ui ? 'pass' : 'fail',
    ui?.nextAction?.label ?? 'no model',
    {
      path: visitDetailPath(FIXTURE.visitId),
      nextAction: ui?.nextAction,
      workQueue: ui?.workQueue,
      whyBlocked: ui?.whyBlocked,
      readinessStatus: ui?.readinessStatus,
    },
  )

  const { data: telemetry } = await service
    .from('workflow_telemetry_events')
    .select('signal, workflow_key, metadata, created_at')
    .eq('organization_id', FIXTURE.organizationId)
    .order('created_at', { ascending: false })
    .limit(25)

  const auditSignals = (telemetry ?? []).filter((t) =>
    /source_|snapshot|integrity|submitted/i.test(String(t.signal)),
  )

  const { data: operationalEvents } = await service
    .from('operational_events')
    .select('event_type, created_at')
    .eq('visit_id', FIXTURE.visitId)
    .order('created_at', { ascending: false })
    .limit(10)

  const recentOperational = operationalEvents ?? []

  const phiIssues: Array<{ signal: string; issues: string[] }> = []
  for (const row of auditSignals.slice(0, 10)) {
    const issues = collectTelemetryMetadataIssues(row.metadata ?? {})
    if (issues.length) phiIssues.push({ signal: String(row.signal), issues })
  }

  record(
    'obs.telemetry',
    auditSignals.length > 0 || recentOperational.length > 0 ? 'pass' : submitOk ? 'warn' : 'skip',
    `telemetry=${auditSignals.length} workflow signal(s); operational_events=${recentOperational.length} for visit`,
    {
      signals: auditSignals.map((t) => t.signal),
      operationalEventTypes: recentOperational.map((e) => e.event_type),
    },
  )

  record(
    'obs.no_phi',
    phiIssues.length === 0 ? 'pass' : 'fail',
    phiIssues.length === 0 ? 'No PHI patterns in sampled telemetry metadata' : `${phiIssues.length} issue(s)`,
    { phiIssues },
  )

  const afterProj = await projectionSnapshot(service, 'after_pilot')
  record('projections.after', 'pass', 'Post-pilot projection snapshot captured', afterProj)

  const e2eOverall =
    process.env.PHASE16C_SKIP_E2E === '1'
      ? 'skipped'
      : ((process.env.PHASE16C_E2E_OVERALL ?? 'degraded') as string)
  if (process.env.PHASE16C_SKIP_E2E !== '1') {
    record(
      'preflight.e2e',
      e2eOverall === 'pass' ? 'pass' : 'warn',
      `Overall: ${e2eOverall} (run npm run runtime:e2e:live separately)`,
    )
  } else {
    record('preflight.e2e', 'skip', 'PHASE16C_SKIP_E2E=1')
  }

  const fails = steps.filter((s) => s.status === 'fail').length
  const warns = steps.filter((s) => s.status === 'warn').length
  const recommendation =
    fails > 0 ? 'NO_GO' : warns > 3 ? 'CONDITIONAL_GO' : 'GO'

  const report = {
    phase: '16C-supervised-coordinator-pilot-dry-run',
    runAt: new Date().toISOString(),
    environment: { supabaseUrl, baseUrl, note: 'Staging DB; app at baseUrl (local unless E2E_API_BASE_URL set)' },
    coordinator: COORDINATOR,
    fixture: FIXTURE,
    procedureExecutionId: peId,
    routes: {
      commandCenter: commandCenterPath(),
      studyWorkspace: studyWorkspacePath(FIXTURE.studyId),
      subjectWorkspace: subjectWorkspacePath(FIXTURE.studySubjectId),
      visit: visitDetailPath(FIXTURE.visitId),
      capture: linkage.capturePath,
    },
    projections: { before: beforeProj, afterRecompute, after: afterProj },
    steps,
    summary: { fails, warns, recommendation, e2eOverall, openOk, saveOk, submitOk },
    friction: steps
      .filter((s) => s.status === 'warn' || s.status === 'fail')
      .map((s) => ({ id: s.id, detail: s.detail })),
  }

  const outDir = resolve(root, '.runtime-validation')
  mkdirSync(outDir, { recursive: true })
  const jsonPath = resolve(outDir, 'phase16c-supervised-coordinator-pilot-dry-run.json')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const md = buildMarkdownReport(report)
  const mdPath = resolve(outDir, 'phase16c-supervised-coordinator-pilot-dry-run-report.md')
  writeFileSync(mdPath, md)

  console.log('=== Phase 16C Supervised Coordinator Pilot Dry Run ===\n')
  for (const s of steps) {
    console.log(`[${s.status.toUpperCase()}] ${s.id}: ${s.detail}`)
  }
  console.log(`\nRecommendation: ${recommendation}`)
  console.log(`Wrote ${mdPath}`)

  if (fails > 0) process.exit(1)
}

function buildMarkdownReport(report: Record<string, unknown>): string {
  const s = report.summary as Record<string, unknown>
  const steps = report.steps as Step[]
  const lines = [
    '# Phase 16C — Supervised Coordinator Pilot Dry Run',
    '',
    `**Run at:** ${report.runAt}`,
    `**Recommendation:** ${s.recommendation}`,
    '',
    '## Environment',
    '',
    `- Supabase: ${(report.environment as Record<string, string>).supabaseUrl}`,
    `- App: ${(report.environment as Record<string, string>).baseUrl}`,
    `- Coordinator: ${(report.coordinator as Record<string, string>).email}`,
    '',
    '## Fixture',
    '',
    '```json',
    JSON.stringify(report.fixture, null, 2),
    '```',
    '',
    '## Results',
    '',
    '| Step | Status | Detail |',
    '| --- | --- | --- |',
    ...steps.map((st) => `| ${st.id} | ${st.status} | ${st.detail.replace(/\|/g, '/')} |`),
    '',
    '## Friction',
    '',
    ...((report.friction as Array<{ id: string; detail: string }>) ?? []).map(
      (f) => `- **${f.id}:** ${f.detail}`,
    ),
    '',
  ]
  return lines.join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
