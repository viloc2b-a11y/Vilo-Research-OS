/**
 * Phase 9 runtime automation smoke (no DB).
 * Run: npx tsx scripts/phase9-runtime-automation-smoke.ts
 */
import assert from 'node:assert/strict'
import { adaptOperationalOverload } from '../lib/runtime-automation/adapt/overload-adaptation'
import { adaptRuntimeUrgency } from '../lib/runtime-automation/adapt/urgency-adaptation'
import { buildVisitAutomationContext } from '../lib/runtime-automation/context/build-automation-context'
import { RUNTIME_AUTOMATION_VERSION } from '../lib/runtime-automation/constants'
import { deriveProposedAutomationActions } from '../lib/runtime-automation/evaluate/derive-actions'
import { evaluateAutomationTriggers } from '../lib/runtime-automation/evaluate/triggers'
import { deriveAutomationPlanFromOrchestration } from '../lib/runtime-automation/integration/coordinator-bridge'
import { buildVisitRuntimeAutomationPlan } from '../lib/runtime-automation/plan/build-plan'
import {
  applyBlockedBySafeguards,
  evaluateAutomationGovernanceSafeguards,
} from '../lib/runtime-automation/safeguards/governance'
import type { VisitCoordinatorOrchestration } from '../lib/coordinator-orchestration/types'
import type { VisitReadinessProjection } from '../lib/projections/types'

function mockReadiness(): VisitReadinessProjection {
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
    blockerCount: 2,
    blockers: [
      {
        id: 'safety-ae',
        category: 'safety_continuity',
        severity: 'blocker',
        label: 'Unresolved AE',
        detail: 'Open AE',
      },
      {
        id: 'gov-dev',
        category: 'governance',
        severity: 'warning',
        label: 'Governance deviation',
        detail: 'Deviation open',
      },
    ],
    snapshot: {
      scheduledDate: '2020-01-01',
      visitStatus: 'in_progress',
      replayBlockedSummary: 'safety: friction',
      operationalIntelligence: { burdenScore: 75 },
      financialRuntime: { leakageScore: 50 },
    },
  }
}

function mockOrchestration(): VisitCoordinatorOrchestration {
  return {
    visitId: 'v1',
    organizationId: 'o1',
    studyId: 's1',
    studySubjectId: 'sub1',
    computedAt: new Date().toISOString(),
    orchestrationVersion: 1,
    nextActions: [
      {
        id: 'action:pi',
        kind: 'pi_review',
        priority: 90,
        label: 'PI review',
        detail: 'CBC',
        domain: 'safety',
        requiresEscalation: true,
        requiresPiReview: true,
      },
    ],
    priorityScores: {
      patientSafetyRisk: 60,
      protocolRisk: 40,
      visitTimelinePressure: 70,
      coordinatorBurden: 75,
      unresolvedGovernance: 30,
      financialLeakage: 50,
      compositeScore: 65,
    },
    urgency: { level: 'high', urgencyScore: 72, drivers: ['timeline'], slaPressure: true },
    blockerChains: [],
    workQueue: {
      actionNow: [{ actionId: 'a1', bucket: 'action_now', kind: 'pi_review', label: 'PI', priority: 90 }],
      canWait: [],
      blocked: [],
      escalation: [],
      piReview: [{ actionId: 'a2', bucket: 'pi_review', kind: 'pi_review', label: 'PI', priority: 90 }],
      coordinatorFollowUp: [],
    },
    visitExecution: {
      phase: 'closeout',
      primaryObjective: 'Close visit',
      pendingProcedureCount: 0,
      signoffBlocked: true,
      graphBlocked: false,
      recommendedSequence: ['Submit source'],
    },
    financialLeakageEscalation: {
      leakageScore: 50,
      criticalLeakageCount: 1,
      topLeakageKinds: ['executed_unsigned'],
      recommendedActions: ['Sign procedures'],
    },
    topPriorityScore: 90,
    snapshot: {},
  }
}

function smokeTriggersAndPlan() {
  const readiness = mockReadiness()
  const orchestration = mockOrchestration()
  const ctx = buildVisitAutomationContext({
    readiness,
    orchestration,
    rescheduleCount: 3,
    overdueWorkflowCount: 2,
  })
  const triggered = evaluateAutomationTriggers(ctx)
  assert.ok(triggered.some((t) => t.trigger === 'unresolved_safety'))
  assert.ok(triggered.some((t) => t.trigger === 'repeated_reschedules'))
  assert.ok(triggered.some((t) => t.trigger === 'financial_leakage'))

  const plan = buildVisitRuntimeAutomationPlan(ctx)
  assert.ok(plan.proposedActions.length > 0)
  assert.ok(plan.coordinatorSupervised)
  assert.ok(plan.adaptedUrgency.adaptedUrgencyScore >= plan.adaptedUrgency.baseUrgencyScore)
}

function smokeCoordinatorBridge() {
  const plan = deriveAutomationPlanFromOrchestration({
    readiness: mockReadiness(),
    orchestration: mockOrchestration(),
    rescheduleCount: 2,
  })
  assert.ok(plan.triggeredRules.length > 0)
}

function smokeOverload() {
  const orchestration = mockOrchestration()
  const actions = deriveProposedAutomationActions({
    ctx: buildVisitAutomationContext({
      readiness: mockReadiness(),
      orchestration,
    }),
    triggered: evaluateAutomationTriggers(
      buildVisitAutomationContext({ readiness: mockReadiness(), orchestration }),
    ),
    orchestrationActions: orchestration.nextActions,
  })
  const { adaptation, throttled } = adaptOperationalOverload({
    orchestration,
    proposedActions: actions,
  })
  assert.equal(adaptation.overloadDetected, true)
  assert.ok(throttled.length <= adaptation.maxActionsPerCycle)
}

function smokeSafeguards() {
  const safeguards = evaluateAutomationGovernanceSafeguards({
    proposedActions: [],
    hasClinicalMutationAttempt: true,
  })
  assert.equal(applyBlockedBySafeguards(safeguards), true)
}

function smokeUrgencyAdapt() {
  const u = adaptRuntimeUrgency({
    orchestration: mockOrchestration(),
    triggered: [{ ruleId: 'rule:safety:unresolved', trigger: 'unresolved_safety', severity: 'critical', detail: 'x' }],
  })
  assert.ok(u.adaptedUrgencyScore > u.baseUrgencyScore)
}

function main() {
  assert.equal(RUNTIME_AUTOMATION_VERSION, 1)
  smokeTriggersAndPlan()
  smokeCoordinatorBridge()
  smokeOverload()
  smokeSafeguards()
  smokeUrgencyAdapt()
  console.log('phase9-runtime-automation-smoke: OK')
}

main()
