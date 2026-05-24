import { ensureVisitCheckInChronology } from '@/lib/operations/ensure-visit-check-in-chronology'
import { buildRuntimeIntegrityReport } from '@/lib/runtime-integrity/report/build-report'
import { loadVisitReadinessProjection } from '@/lib/projections/load'
import {
  refreshSubjectRuntimeProjection,
  refreshVisitReadinessProjection,
} from '@/lib/projections/refresh'
import { rebuildVisitReplay } from '@/lib/runtime-replay/rebuild/visit-replay'
import { verifyPilotProcedureSourceBinding } from '@/lib/runtime-validation/verify-pilot-source-binding'
import { loadVisitRuntimeUiModel } from '@/lib/runtime-ui/load'
import { computeVisitRuntimeAutomation } from '@/lib/runtime-automation/compute-visit'
import { applyVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/execute/apply-plan'
import type { RuntimeChainCheck, RuntimeValidationFailure } from '@/lib/runtime-validation/types'
import { failure } from '@/lib/runtime-validation/failure-report'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LivePilotScope = {
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
}

export async function runLivePilotValidation(input: {
  supabase: SupabaseClient
  scope: LivePilotScope
  applyAutomation?: boolean
  actorUserId?: string | null
}): Promise<{
  checks: RuntimeChainCheck[]
  failures: RuntimeValidationFailure[]
  integrityReport: Record<string, unknown> | null
  replaySummary: Record<string, unknown> | null
  projectionSummary: Record<string, unknown> | null
  uiModelSummary: Record<string, unknown> | null
}> {
  const checks: RuntimeChainCheck[] = []
  const failures: RuntimeValidationFailure[] = []
  const { supabase, scope } = input

  const sourceBinding = await verifyPilotProcedureSourceBinding({
    supabase,
    organizationId: scope.organizationId,
    studyId: scope.studyId,
  })
  if (!sourceBinding.ok) {
    failures.push(
      failure(
        'pilot-source-binding',
        'warning',
        sourceBinding.message,
        'Run node scripts/phase9a-staging-hygiene.mjs on staging.',
      ),
    )
  }

  const checkInBridge = await ensureVisitCheckInChronology({
    supabase,
    organizationId: scope.organizationId,
    studyId: scope.studyId,
    visitId: scope.visitId,
    actorUserId: input.actorUserId ?? null,
  })

  const { count: eventCount } = await supabase
    .from('operational_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', scope.visitId)

  checks.push({
    id: 'events-on-mutation-live',
    goal: 1,
    label: 'Runtime actions emit operational_events (live visit)',
    status: (eventCount ?? 0) > 0 ? 'pass' : 'warn',
    detail: `${eventCount ?? 0} operational_event(s) for visit.`,
    evidence: { eventCount, checkInBridge, sourceBinding },
  })

  const refresh = await refreshVisitReadinessProjection(
    supabase,
    scope.visitId,
    scope.organizationId,
  )

  await refreshSubjectRuntimeProjection(supabase, scope.studySubjectId, scope.organizationId)

  if (!refresh.ok) {
    failures.push(
      failure(
        'events-refresh-projections',
        'blocker',
        refresh.error ?? 'refreshVisitReadinessProjection failed',
      ),
    )
    checks.push({
      id: 'events-refresh-projections-live',
      goal: 2,
      label: 'Events / compute refresh derived projections',
      status: 'fail',
      detail: refresh.error ?? 'refreshVisitReadinessProjection failed',
    })
    return { checks, failures, integrityReport: null, replaySummary: null, projectionSummary: null, uiModelSummary: null }
  }

  const { data: readinessRow } = await supabase
    .from('visit_readiness_projections')
    .select('computed_at, readiness_status, blocker_count, blockers, safety_blocker_count, missing_source_count')
    .eq('visit_id', scope.visitId)
    .maybeSingle()

  const readiness = readinessRow
    ? {
        readinessStatus: readinessRow.readiness_status as string,
        blockerCount: readinessRow.blocker_count as number,
        missingSourceCount: readinessRow.missing_source_count as number,
        safetyBlockerCount: readinessRow.safety_blocker_count as number,
        blockers: (readinessRow.blockers as unknown[]) ?? [],
      }
    : null

  if (!readiness) {
    failures.push(failure('events-refresh-projections', 'blocker', 'Visit readiness projection row missing after refresh.'))
    checks.push({
      id: 'events-refresh-projections-live',
      goal: 2,
      label: 'Events / compute refresh derived projections',
      status: 'fail',
      detail: 'visit_readiness_projections row missing after refresh',
    })
    return { checks, failures, integrityReport: null, replaySummary: null, projectionSummary: null, uiModelSummary: null }
  }

  checks.push({
    id: 'events-refresh-projections-live',
    goal: 2,
    label: 'Events / compute refresh derived projections',
    status: 'pass',
    detail: `visit_readiness_projections: ${readiness.readinessStatus}, ${readiness.blockerCount} blocker(s)`,
    evidence: { refresh },
  })

  const blockers = readiness.blockers as Array<{ category?: string; id?: string }>
  const graphBlockers = blockers.filter((b) => b.category === 'protocol_graph' || b.id?.includes('graph'))
  checks.push({
    id: 'graph-blockers-live',
    goal: 3,
    label: 'Protocol graph blockers appear in readiness',
    status: graphBlockers.length > 0 ? 'pass' : readiness.readinessStatus === 'ready' ? 'skip' : 'warn',
    detail:
      graphBlockers.length > 0
        ? `${graphBlockers.length} graph blocker(s)`
        : `readiness=${readiness.readinessStatus} (no graph blockers — OK if visit ready)`,
  })

  const sg = blockers.filter(
    (b) => b.category?.includes('safety') || b.category?.includes('governance'),
  )
  checks.push({
    id: 'safety-governance-carry-live',
    goal: 4,
    label: 'Safety/governance blockers carry forward',
    status:
      sg.length > 0 || readiness.safetyBlockerCount > 0
        ? 'pass'
        : readiness.readinessStatus === 'ready'
          ? 'skip'
          : 'warn',
    detail: `${sg.length} projection blocker(s), safetyBlockerCount=${readiness.safetyBlockerCount}`,
  })

  const replay = await rebuildVisitReplay({
    supabase,
    organizationId: scope.organizationId,
    studyId: scope.studyId,
    visitId: scope.visitId,
    includeReadinessExplanation: true,
  })

  const replayBlocked = Boolean(replay?.explanations.readinessBlocked?.blocked)
  const replayCauses = replay?.explanations.readinessBlocked?.primaryCauses ?? []

  checks.push({
    id: 'replay-explains-blocked-live',
    goal: 5,
    label: 'Replay explains blocked readiness',
    status:
      replay && (replayCauses.length > 0 || readiness.readinessStatus !== 'blocked')
        ? 'pass'
        : 'fail',
    detail: replayCauses.slice(0, 3).join('; ') || `segments=${replay?.timeline?.length ?? 0}`,
    evidence: { replayBlocked },
  })

  const { data: finRow } = await supabase
    .from('visit_financial_runtime_projections')
    .select('leakage_score, earned_procedure_count, leakage_item_count')
    .eq('visit_id', scope.visitId)
    .maybeSingle()

  checks.push({
    id: 'financial-leakage-live',
    goal: 6,
    label: 'Financial leakage derives correctly',
    status: finRow ? 'pass' : 'fail',
    detail: finRow
      ? `leakage_score=${finRow.leakage_score}, items=${finRow.leakage_item_count}`
      : 'visit_financial_runtime_projections missing',
  })

  const { data: orchRow } = await supabase
    .from('visit_coordinator_orchestration_projections')
    .select('next_actions, top_priority_score')
    .eq('visit_id', scope.visitId)
    .maybeSingle()

  const nextActions = (orchRow?.next_actions as unknown[]) ?? []
  checks.push({
    id: 'coordinator-next-action-live',
    goal: 7,
    label: 'Coordinator next action appears',
    status: nextActions.length > 0 ? 'pass' : 'warn',
    detail:
      nextActions.length > 0
        ? String((nextActions[0] as { label?: string })?.label ?? 'action')
        : 'no next_actions in orchestration projection',
  })

  const readinessProjection = await loadVisitReadinessProjection(
    supabase,
    scope.visitId,
    scope.organizationId,
    { refreshIfStale: false },
  )

  const automation = readinessProjection
    ? await computeVisitRuntimeAutomation({
        supabase,
        organizationId: scope.organizationId,
        studyId: scope.studyId,
        visitId: scope.visitId,
        readiness: readinessProjection,
      })
    : null

  const { data: autoRow } = await supabase
    .from('visit_runtime_automation_projections')
    .select('pending_apply_count, proposed_actions')
    .eq('visit_id', scope.visitId)
    .maybeSingle()

  let applyResult:
    | Awaited<ReturnType<typeof applyVisitRuntimeAutomationPlan>>
    | null = null
  let applyError: string | null = null

  if (input.applyAutomation) {
    if (!input.actorUserId) {
      failures.push(
        failure(
          'automation-propose-apply-live',
          'warning',
          'Automation apply requested without --actor-user-id.',
          'Rerun with --actor-user-id set to the coordinator user UUID.',
        ),
      )
    } else if (automation && automation.plan.proposedActions.length > 0) {
      try {
        applyResult = await applyVisitRuntimeAutomationPlan({
          supabase,
          automation,
          actorUserId: input.actorUserId,
          actionIds: [automation.plan.proposedActions[0].id],
        })
      } catch (err) {
        applyError = err instanceof Error ? err.message : String(err)
        failures.push(
          failure(
            'automation-propose-apply-live',
            'blocker',
            applyError,
            'Inspect runtime_automation_executions, operational_events, and workflow materialization before rerunning apply.',
          ),
        )
      }
    }
  }

  const automationApplyStatus: RuntimeChainCheck['status'] =
    input.applyAutomation
      ? applyError
        ? 'fail'
        : applyResult && applyResult.applied > 0
          ? 'pass'
          : 'warn'
      : automation && (automation.plan.proposedActions.length > 0 || (autoRow?.pending_apply_count ?? 0) === 0)
        ? 'pass'
        : 'warn'

  checks.push({
    id: 'automation-propose-apply-live',
    goal: 8,
    label: 'Automation proposal can be applied (supervised)',
    status: automationApplyStatus,
    detail: automation
      ? `${automation.plan.proposedActions.length} proposed; pending=${automation.pendingApplyCount}; applied=${applyResult?.applied ?? 0}${applyError ? `; error=${applyError}` : ''}`
      : 'automation compute null',
    evidence: applyResult ? { applyResult } : undefined,
  })

  const ui = await loadVisitRuntimeUiModel(supabase, scope.visitId, scope.organizationId, { refresh: false })

  checks.push({
    id: 'ui-runtime-intelligence-live',
    goal: 9,
    label: 'UI model surfaces runtime intelligence',
    status: ui?.nextAction || ui?.whyBlocked.blocked !== undefined ? 'pass' : 'fail',
    detail: ui
      ? `next="${ui.nextAction?.label ?? 'n/a'}", readiness=${ui.readinessStatus}`
      : 'loadVisitRuntimeUiModel null',
  })

  const integrityReport = await buildRuntimeIntegrityReport({
    supabase,
    scope: 'visit',
    scopeId: scope.visitId,
    organizationId: scope.organizationId,
    studyId: scope.studyId,
  })

  const visitReplayGaps = (
    (integrityReport.replayGaps as Array<{ id?: string; kind?: string }>) ?? []
  ).filter((g) => !String(g.id ?? '').startsWith('catalog:'))
  const missingProjection = (
    (integrityReport.projectionFreshness as Array<{ issue?: string }>) ?? []
  ).some((p) => p.issue === 'missing')

  checks.push({
    id: 'no-silent-mutation-live',
    goal: 10,
    label: 'No silent mutation breaks the chain (live integrity)',
    status:
      missingProjection || visitReplayGaps.some((g) => g.kind === 'missing_spine_event')
        ? 'warn'
        : 'pass',
    detail: `integrity overall=${integrityReport.overallStatus}; visit replay gaps=${visitReplayGaps.length}`,
  })

  const projectionTables = [
    'visit_readiness_projections',
    'visit_coordinator_orchestration_projections',
    'visit_financial_runtime_projections',
    'visit_runtime_automation_projections',
  ]
  const missing = []
  for (const table of projectionTables) {
    const { data } = await supabase.from(table).select('visit_id').eq('visit_id', scope.visitId).maybeSingle()
    if (!data && table !== 'visit_runtime_automation_projections') {
      missing.push(table)
    }
  }
  if (missing.length > 0) {
    failures.push(
      failure(
        'events-refresh-projections-live',
        'warning',
        `Missing projection rows: ${missing.join(', ')}`,
        'Run refreshVisitReadinessProjection (includes persistSafetyGovernance enrich chain).',
      ),
    )
  }

  return {
    checks,
    failures,
    integrityReport: integrityReport as unknown as Record<string, unknown>,
    replaySummary: replay
      ? {
          segmentCount: replay.timeline.length,
          blocked: replay.explanations.readinessBlocked?.blocked,
          primaryCauses: replay.explanations.readinessBlocked?.primaryCauses?.slice(0, 5),
        }
      : null,
    projectionSummary: {
      readinessStatus: readiness.readinessStatus,
      blockerCount: readiness.blockerCount,
      missingSourceCount: readiness.missingSourceCount,
      safetyBlockerCount: readiness.safetyBlockerCount,
    },
    uiModelSummary: ui
      ? {
          nextAction: ui.nextAction?.label,
          leakageShow: ui.leakage.show,
          automationCount: ui.automationProposals.length,
          automationApplied: applyResult?.applied ?? 0,
        }
      : null,
  }
}
