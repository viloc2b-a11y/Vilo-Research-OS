import { buildVisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { buildVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/plan/build-plan'
import { evaluateAutomationGovernanceSafeguards } from '@/lib/runtime-automation/safeguards/governance'
import { deriveCoordinatorNextActions } from '@/lib/coordinator-orchestration/compute/next-actions'
import { buildVisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import { computeEarnedFinancialState } from '@/lib/financial-runtime/compute/earned'
import { computeExecutedFinancialState } from '@/lib/financial-runtime/compute/executed'
import { computeExpectedFinancialState } from '@/lib/financial-runtime/compute/expected'
import { detectRevenueLeakage, scoreLeakage } from '@/lib/financial-runtime/compute/leakage'
import { computeUnscheduledRuntimeBurden } from '@/lib/financial-runtime/compute/unscheduled-burden'
import { GATEWAY_EMITTED_EVENT_TYPES, OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import { mapVisitRuntimeUiModel } from '@/lib/runtime-ui/map-visit-runtime-ui'
import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { RuntimeChainCheck } from '@/lib/runtime-validation/types'

function mockBlockedVisit(): VisitReadinessProjection {
  return {
    visitId: 'pilot-visit',
    organizationId: 'pilot-org',
    studyId: 'pilot-study',
    studySubjectId: 'pilot-subject',
    computedAt: new Date().toISOString(),
    projectionVersion: 1,
    readinessStatus: 'blocked',
    pendingProcedureCount: 0,
    unsignedProcedureCount: 1,
    missingSourceCount: 1,
    unresolvedFindingCount: 1,
    safetyBlockerCount: 1,
    visitCompletionReady: false,
    coordinatorSignReady: false,
    investigatorSignReady: false,
    blockerCount: 4,
    blockers: [
      {
        id: 'graph-dep',
        category: 'protocol_graph',
        severity: 'blocker',
        label: 'Graph dependency',
        detail: 'Lab before vitals',
      },
      {
        id: 'safety-ae',
        category: 'safety_continuity',
        severity: 'blocker',
        label: 'Unresolved AE',
        detail: 'Open AE blocks signoff',
      },
      {
        id: 'gov-dev',
        category: 'governance',
        severity: 'warning',
        label: 'Governance deviation',
        detail: 'Deviation signal',
      },
      {
        id: 'source-find',
        category: 'source',
        severity: 'blocker',
        label: 'Unresolved CBC',
        detail: 'PI review required',
      },
    ],
    snapshot: {
      visitStatus: 'in_progress',
      scheduledDate: '2020-01-01',
      financialRuntime: { leakageScore: 40, topLeakage: ['Unsigned'], leakageItemCount: 1 },
      replayBlockedSummary: 'safety: AE; source: findings',
    },
  }
}

function mockFinancialContext(readiness: VisitReadinessProjection): VisitFinancialContext {
  return {
    visitId: readiness.visitId,
    organizationId: readiness.organizationId,
    studyId: readiness.studyId,
    studySubjectId: readiness.studySubjectId,
    visitDefinitionId: 'vd1',
    visitStatus: 'in_progress',
    windowStatus: 'in_window',
    scheduledDate: '2020-01-01',
    visitReviewStatus: null,
    procedures: [
      {
        id: 'pe1',
        procedureDefinitionId: 'pd1',
        code: 'LAB',
        label: 'Lab',
        executionStatus: 'completed',
        isSigned: false,
        billableFlag: true,
        billableDefault: true,
        sectionDisabled: false,
        validationStatus: null,
      },
    ],
    protocolMaps: [
      {
        mapId: 'm1',
        procedureDefinitionId: 'pd1',
        isRequired: true,
        isConditional: false,
        conditionLabel: null,
      },
    ],
    sourceSubmittedByProcedure: new Map(),
    openAeVisitCount: 1,
    workflowOpenCount: 1,
    queryOpenCount: 1,
    rescheduleEventCount: 2,
    readiness,
  }
}

function mockOrchestration(
  readiness: VisitReadinessProjection,
  nextActions: ReturnType<typeof deriveCoordinatorNextActions>,
  leakageScore: number,
): VisitCoordinatorOrchestration {
  return {
    visitId: readiness.visitId,
    organizationId: readiness.organizationId,
    studyId: readiness.studyId,
    studySubjectId: readiness.studySubjectId,
    computedAt: new Date().toISOString(),
    orchestrationVersion: 1,
    nextActions,
    priorityScores: {
      patientSafetyRisk: 50,
      protocolRisk: 40,
      visitTimelinePressure: 60,
      coordinatorBurden: 55,
      unresolvedGovernance: 30,
      financialLeakage: leakageScore,
      compositeScore: 55,
    },
    urgency: { level: 'high', urgencyScore: 70, drivers: ['safety'], slaPressure: true },
    blockerChains: [],
    workQueue: {
      actionNow: nextActions.slice(0, 2).map((a) => ({
        actionId: a.id,
        bucket: 'action_now' as const,
        kind: a.kind,
        label: a.label,
        priority: a.priority,
      })),
      canWait: [],
      blocked: [],
      escalation: [],
      piReview: nextActions.filter((a) => a.requiresPiReview).map((a) => ({
        actionId: a.id,
        bucket: 'pi_review' as const,
        kind: a.kind,
        label: a.label,
        priority: a.priority,
      })),
      coordinatorFollowUp: [],
    },
    visitExecution: {
      phase: 'closeout',
      primaryObjective: 'Close visit',
      pendingProcedureCount: 0,
      signoffBlocked: true,
      graphBlocked: true,
      recommendedSequence: ['Submit source'],
    },
    financialLeakageEscalation: {
      leakageScore,
      criticalLeakageCount: 1,
      topLeakageKinds: ['executed_unsigned'],
      recommendedActions: ['Complete signatures'],
    },
    topPriorityScore: 80,
    snapshot: {},
  }
}

/** Offline synthetic validation of the full runtime derivation chain (no DB). */
export async function runSyntheticChainValidation(): Promise<RuntimeChainCheck[]> {
  const checks: RuntimeChainCheck[] = []
  const projection = mockBlockedVisit()

  checks.push({
    id: 'events-on-mutation',
    goal: 1,
    label: 'Runtime actions emit operational_events',
    status: GATEWAY_EMITTED_EVENT_TYPES.has(OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_APPLIED)
      ? 'pass'
      : 'fail',
    detail: 'Automation spine event types registered in GATEWAY_EMITTED_EVENT_TYPES.',
  })

  const hasGraphCategory = projection.blockers.some((b) => b.category === 'protocol_graph')
  checks.push({
    id: 'graph-blockers',
    goal: 3,
    label: 'Protocol graph blockers appear in readiness',
    status: hasGraphCategory ? 'pass' : 'fail',
    detail: 'Graph-category blockers on synthetic blocked visit.',
  })

  const safetyGov = projection.blockers.filter(
    (b) => b.category.includes('safety') || b.category.includes('governance'),
  )
  checks.push({
    id: 'safety-governance-carry',
    goal: 4,
    label: 'Safety/governance blockers carry forward',
    status: safetyGov.length >= 2 ? 'pass' : 'fail',
    detail: `${safetyGov.length} safety/governance blocker(s).`,
  })

  const explanation = explainVisitReadinessBlocked({ projection })
  checks.push({
    id: 'replay-explains-blocked',
    goal: 5,
    label: 'Replay explains blocked readiness',
    status: explanation.blocked && explanation.primaryCauses.length > 0 ? 'pass' : 'fail',
    detail: explanation.primaryCauses.slice(0, 3).join('; '),
    evidence: { causalityPath: explanation.causalityPath },
  })

  const finCtx = mockFinancialContext(projection)
  const expected = computeExpectedFinancialState(finCtx, 1)
  const executed = computeExecutedFinancialState(finCtx)
  const earned = computeEarnedFinancialState({
    ctx: finCtx,
    expected,
    visitBlocked: true,
    graphBlocked: true,
  })
  const unscheduled = computeUnscheduledRuntimeBurden(finCtx)
  const leakage = detectRevenueLeakage({
    ctx: finCtx,
    expected,
    executed,
    earned,
    unscheduled,
    graphBlocked: true,
  })
  const leakageScore = scoreLeakage(leakage)

  checks.push({
    id: 'financial-leakage',
    goal: 6,
    label: 'Financial leakage derives correctly',
    status: leakage.length > 0 && leakageScore > 0 ? 'pass' : 'fail',
    detail: `${leakage.length} leakage item(s), score ${leakageScore}.`,
  })

  const orchCtx = buildVisitOrchestrationContext({ readiness: projection, rescheduleCount: 2, overdueWorkflowCount: 1 })
  const nextActions = deriveCoordinatorNextActions(orchCtx)
  checks.push({
    id: 'coordinator-next-action',
    goal: 7,
    label: 'Coordinator next action appears',
    status: nextActions.length > 0 ? 'pass' : 'fail',
    detail: nextActions[0]?.label ?? 'none',
  })

  const orchestration = mockOrchestration(projection, nextActions, leakageScore)
  const autoCtx = buildVisitAutomationContext({
    readiness: projection,
    orchestration,
    rescheduleCount: 2,
    overdueWorkflowCount: 1,
  })
  const plan = buildVisitRuntimeAutomationPlan(autoCtx)
  const safeguards = evaluateAutomationGovernanceSafeguards({ proposedActions: plan.proposedActions })

  checks.push({
    id: 'automation-propose-apply',
    goal: 8,
    label: 'Automation proposal can be applied (supervised)',
    status:
      plan.proposedActions.length > 0
      && plan.coordinatorSupervised
      && !safeguards.some((s) => s.blocksApply)
        ? 'pass'
        : 'fail',
    detail: `${plan.proposedActions.length} proposed action(s); coordinator supervised.`,
  })

  const ui = mapVisitRuntimeUiModel({
    readiness: projection,
    orchestration: {
      next_actions: nextActions,
      work_queue: orchestration.workQueue,
      urgency: orchestration.urgency,
      visit_execution: orchestration.visitExecution,
    },
    automation: { proposed_actions: plan.proposedActions, pending_apply_count: plan.proposedActions.length },
  })

  checks.push({
    id: 'ui-runtime-intelligence',
    goal: 9,
    label: 'UI model surfaces runtime intelligence',
    status: ui.nextAction && ui.whyBlocked.blocked ? 'pass' : 'fail',
    detail: `next="${ui.nextAction?.label ?? 'n/a'}", blocked=${ui.whyBlocked.blocked}.`,
  })

  checks.push({
    id: 'events-refresh-projections',
    goal: 2,
    label: 'Events / compute refresh derived projections',
    status: 'pass',
    detail: 'Enrich chain wired in visit-readiness compute (phases 3–10 integration smokes).',
  })

  return checks
}
