/**
 * Phase 10 runtime UI smoke (view-model mapping, no DB).
 * Run: npx tsx scripts/phase10-runtime-ui-smoke.ts
 */
import assert from 'node:assert/strict'
import { mapVisitRuntimeUiModel } from '../lib/runtime-ui/map-visit-runtime-ui'
import { mapSubjectRuntimeUiModel } from '../lib/runtime-ui/map-subject-runtime-ui'
import { shouldShowLeakageWarning } from '../lib/runtime-ui/guardrails'
import type { VisitReadinessProjection } from '../lib/projections/types'

function mockVisitReadiness(): VisitReadinessProjection {
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
    missingSourceCount: 1,
    unresolvedFindingCount: 1,
    safetyBlockerCount: 1,
    visitCompletionReady: false,
    coordinatorSignReady: false,
    investigatorSignReady: false,
    blockerCount: 2,
    blockers: [
      {
        id: 'gov-1',
        category: 'governance',
        severity: 'blocker',
        label: 'Governance hold',
        detail: 'Deviation open',
      },
      {
        id: 'safety-1',
        category: 'safety_continuity',
        severity: 'blocker',
        label: 'Unresolved AE',
        detail: 'Open AE',
      },
    ],
    snapshot: {
      financialRuntime: { leakageScore: 45, topLeakage: ['Unsigned procedure'], leakageItemCount: 1 },
      coordinatorOrchestration: {
        nextActionLabel: 'Submit missing source',
        nextActionKind: 'source_correction',
        piReviewCount: 1,
        urgencyLevel: 'high',
        visitPhase: 'closeout',
      },
      replayBlockedSummary: 'safety: AE',
    },
  }
}

function smokeVisitUi() {
  const ui = mapVisitRuntimeUiModel({
    readiness: mockVisitReadiness(),
    orchestration: {
      next_actions: [
        {
          id: 'a1',
          kind: 'source_correction',
          label: 'Submit missing source',
          detail: 'Blocks signoff',
          priority: 85,
          requiresPiReview: false,
          requiresEscalation: false,
        },
      ],
      work_queue: {
        actionNow: [{ label: 'Submit source', kind: 'source_correction', priority: 85 }],
        piReview: [{ label: 'PI review CBC', kind: 'pi_review', priority: 90 }],
      },
      urgency: { level: 'high' },
      visit_execution: { phase: 'closeout' },
    },
    automation: {
      proposed_actions: [
        {
          id: 'auto:1',
          ruleId: 'rule:financial:leakage',
          kind: 'materialize_workflow',
          label: 'Leakage remediation',
          detail: 'Follow up',
          priority: 70,
          status: 'proposed',
          requiresCoordinatorApproval: true,
        },
      ],
      pending_apply_count: 1,
    },
  })

  assert.equal(ui.nextAction?.label, 'Submit missing source')
  assert.ok(ui.whyBlocked.blocked)
  assert.ok(ui.safetyGovernanceBlockers.length >= 2)
  assert.ok(ui.piReviewNeeded)
  assert.ok(ui.automationProposals.length === 1)
  assert.ok(shouldShowLeakageWarning({ leakageScore: 45, actionableLeakage: true }))
}

function smokeSubjectUi() {
  const ui = mapSubjectRuntimeUiModel({
    subject: {
      studySubjectId: 'sub1',
      organizationId: 'o1',
      studyId: 's1',
      computedAt: new Date().toISOString(),
      projectionVersion: 1,
      longitudinalState: 'active',
      operationalHealth: 'attention',
      unresolvedSafetyCount: 1,
      missedVisitCount: 0,
      pendingWorkflowCount: 2,
      incompleteSourceCount: 1,
      openVisitCount: 2,
      blockerCount: 1,
      blockers: [
        {
          id: 'b1',
          category: 'visit',
          severity: 'blocker',
          label: 'Open visit blocked',
          detail: 'x',
        },
      ],
      snapshot: {
        coordinatorOrchestration: {
          nextActionLabel: 'Coordinator follow-up',
          actionNowCount: 2,
          piReviewCount: 1,
          escalationCount: 0,
          escalationLevel: 'coordinator',
        },
      },
    },
  })

  assert.equal(ui.nextAction?.label, 'Coordinator follow-up')
  assert.equal(ui.workQueueSummary.actionNow, 2)
}

function main() {
  smokeVisitUi()
  smokeSubjectUi()
  console.log('phase10-runtime-ui-smoke: OK')
}

main()
