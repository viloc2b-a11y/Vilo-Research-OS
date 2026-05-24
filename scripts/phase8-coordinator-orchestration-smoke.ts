/**
 * Phase 8 coordinator orchestration smoke (no DB).
 * Run: npx tsx scripts/phase8-coordinator-orchestration-smoke.ts
 */
import assert from 'node:assert/strict'
import { buildBlockerResolutionChains } from '../lib/coordinator-orchestration/compute/blocker-chains'
import { deriveCoordinatorNextActions } from '../lib/coordinator-orchestration/compute/next-actions'
import { computeOperationalPriorityScores } from '../lib/coordinator-orchestration/compute/priority-score'
import { computeRuntimeUrgency } from '../lib/coordinator-orchestration/compute/urgency'
import { buildVisitOrchestrationContext } from '../lib/coordinator-orchestration/context/build-visit-context'
import { COORDINATOR_ORCHESTRATION_VERSION } from '../lib/coordinator-orchestration/constants'
import { orchestrateFinancialLeakageEscalation } from '../lib/coordinator-orchestration/orchestrate/financial-leakage'
import { orchestrateVisitExecution } from '../lib/coordinator-orchestration/orchestrate/visit-execution'
import { deriveWorkQueue } from '../lib/coordinator-orchestration/queue/derive-work-queue'
import type { VisitReadinessProjection } from '../lib/projections/types'

function mockReadiness(overrides?: Partial<VisitReadinessProjection>): VisitReadinessProjection {
  return {
    visitId: 'v1',
    organizationId: 'o1',
    studyId: 's1',
    studySubjectId: 'sub1',
    computedAt: new Date().toISOString(),
    projectionVersion: 1,
    readinessStatus: 'blocked',
    pendingProcedureCount: 0,
    unsignedProcedureCount: 1,
    unresolvedFindingCount: 1,
    missingSourceCount: 1,
    safetyBlockerCount: 1,
    visitCompletionReady: false,
    coordinatorSignReady: false,
    investigatorSignReady: false,
    blockerCount: 3,
    blockers: [
      {
        id: 'unresolved-findings',
        category: 'source',
        severity: 'blocker',
        label: 'Unresolved CBC finding',
        detail: 'Critical lab finding requires PI review',
      },
      {
        id: 'graph-dep-lab',
        category: 'protocol_graph',
        severity: 'blocker',
        label: 'Graph dependency',
        detail: 'Lab must complete before vitals',
      },
      {
        id: 'governance-signoff',
        category: 'governance',
        severity: 'warning',
        label: 'Governance signoff hold',
        detail: 'Deviation signal open',
      },
    ],
    snapshot: {
      visitStatus: 'in_progress',
      scheduledDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      operationalIntelligence: { burdenScore: 55, riskLevel: 'elevated', frictionScore: 40 },
      financialRuntime: { leakageScore: 45, leakageItemCount: 2 },
      replayBlockedSummary: 'safety: Unresolved AE',
    },
    ...overrides,
  }
}

function smokeNextActions() {
  const ctx = buildVisitOrchestrationContext({
    readiness: mockReadiness(),
    leakageItems: [
      {
        id: 'leak:1',
        kind: 'executed_unsigned',
        severity: 'critical',
        label: 'Unsigned',
        detail: 'Lab unsigned',
        procedureExecutionId: 'pe1',
      },
    ],
    rescheduleCount: 2,
    overdueWorkflowCount: 1,
  })
  const actions = deriveCoordinatorNextActions(ctx)
  assert.ok(actions.some((a) => a.kind === 'pi_review'))
  assert.ok(actions.some((a) => a.kind === 'source_correction'))
  assert.ok(actions.some((a) => a.kind === 'graph_resolution'))
  assert.ok(actions.some((a) => a.kind === 'leakage_escalation'))
  assert.ok(actions.some((a) => a.kind === 'operational_escalation'))
}

function smokePriorityAndUrgency() {
  const ctx = buildVisitOrchestrationContext({ readiness: mockReadiness() })
  const scores = computeOperationalPriorityScores(ctx)
  assert.ok(scores.compositeScore > 0)
  const actions = deriveCoordinatorNextActions(ctx)
  const urgency = computeRuntimeUrgency({
    priorityScores: scores,
    nextActions: actions,
    readinessBlocked: true,
    overdueWorkflowCount: 1,
  })
  assert.ok(['low', 'moderate', 'high', 'critical'].includes(urgency.level))
}

function smokeWorkQueue() {
  const readiness = mockReadiness()
  const ctx = buildVisitOrchestrationContext({ readiness })
  const actions = deriveCoordinatorNextActions(ctx)
  const scores = computeOperationalPriorityScores(ctx)
  const urgency = computeRuntimeUrgency({
    priorityScores: scores,
    nextActions: actions,
    readinessBlocked: true,
    overdueWorkflowCount: 0,
  })
  const queue = deriveWorkQueue({ nextActions: actions, urgency, readiness })
  assert.ok(queue.piReview.length > 0 || queue.actionNow.length > 0)
  assert.ok(queue.actionNow.length + queue.canWait.length + queue.blocked.length > 0)
}

function smokeBlockerChains() {
  const readiness = mockReadiness()
  const actions = deriveCoordinatorNextActions(buildVisitOrchestrationContext({ readiness }))
  const chains = buildBlockerResolutionChains({ readiness, nextActions: actions })
  assert.ok(chains.length > 0)
  assert.ok(chains[0].steps.length >= 1)
}

function smokeVisitExecution() {
  const readiness = mockReadiness()
  const ctx = buildVisitOrchestrationContext({ readiness })
  const actions = deriveCoordinatorNextActions(ctx)
  const exec = orchestrateVisitExecution({ ctx, nextActions: actions, graphBlocked: true })
  assert.equal(exec.signoffBlocked, true)
  assert.ok(exec.recommendedSequence.length > 0)
}

function smokeFinancialEscalation() {
  const esc = orchestrateFinancialLeakageEscalation({
    leakageItems: [
      {
        id: 'l1',
        kind: 'executed_unsigned',
        severity: 'critical',
        label: 'Unsigned',
        detail: 'x',
      },
    ],
    leakageScore: 30,
  })
  assert.ok(esc.recommendedActions.length > 0)
}

function main() {
  assert.equal(COORDINATOR_ORCHESTRATION_VERSION, 1)
  smokeNextActions()
  smokePriorityAndUrgency()
  smokeWorkQueue()
  smokeBlockerChains()
  smokeVisitExecution()
  smokeFinancialEscalation()
  console.log('phase8-coordinator-orchestration-smoke: OK')
}

main()
