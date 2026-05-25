/**
 * Phase 16G-3 — Operational calm refinement smoke.
 * Run: npx tsx scripts/phase16g3-operational-calm-refinement-smoke.ts
 */
import assert from 'node:assert/strict'
import type { OperationalWorkQueueItem } from '../lib/coordinator-operations'
import {
  assertNoSurveillanceMetrics,
  continueWhereLeftOff,
  deriveCalmRefinementRecommendations,
  deriveCoordinatorConfidenceSignals,
  groupRecoveryActions,
  isCoordinatorHostileLanguage,
  MAX_CRITICAL_CALM_ACTIONS,
  MAX_SECONDARY_CALM_ACTIONS,
  simplifyOperationalQueues,
  suppressWarnings,
  toCoordinatorSafeOperationalLanguage,
  warningFromQueueItem,
} from '../lib/coordinator-calm'
import { deriveCoordinatorFrictionProjection } from '../lib/coordinator-friction'
import { deriveObservationProjection } from '../lib/coordinator-observation'
import { buildSourceReviewDto } from '../lib/external-access'

function main() {
  const hostile = 'Protocol violation failure enforcement noncompliance'
  const calm = toCoordinatorSafeOperationalLanguage(hostile)
  assert.equal(isCoordinatorHostileLanguage(hostile), true)
  assert.ok(!calm.toLowerCase().includes('violation'))
  assert.ok(!calm.toLowerCase().includes('enforcement'))

  const warnings = [
    warningFromQueueItem({ label: 'Signoff pending', kind: 'signature', priority: 88, scopeLabel: 'Visit A' }),
    warningFromQueueItem({ label: 'Signoff pending', kind: 'signature', priority: 90, scopeLabel: 'Visit A' }),
    warningFromQueueItem({
      label: 'Completion blocked',
      kind: 'blocked',
      priority: 95,
      scopeLabel: 'Visit C',
    }),
    warningFromQueueItem({ label: 'FYI note', kind: 'info', priority: 10, scopeLabel: 'Visit A' }),
  ]
  warnings[3].informationalOnly = true
  warnings[3].acknowledged = true
  warnings[3].severity = 'low'

  const suppressed = suppressWarnings(warnings)
  assert.ok(suppressed.visible.length >= 2 && suppressed.visible.length <= 4)
  assert.ok(suppressed.suppressedCount >= 1)
  assert.ok(suppressed.duplicateCollapsedCount >= 1)

  const queueItems: OperationalWorkQueueItem[] = [
    { label: 'Signoff pending', kind: 'signature', priority: 90 },
    { label: 'Signoff pending', kind: 'signature', priority: 88 },
    { label: 'Source continuity incomplete', kind: 'source', priority: 85 },
    { label: 'FYI informational', kind: 'info', priority: 5 },
    { label: 'Stabilization needed', kind: 'inspection', priority: 82 },
    { label: 'Recovery recommended', kind: 'escalation', priority: 70 },
    { label: 'Chronology needs review', kind: 'deviation', priority: 80 },
  ]

  const simplified = simplifyOperationalQueues([
    { bucket: 'Do now', items: queueItems },
  ])
  assert.ok(simplified.criticalActions.length <= MAX_CRITICAL_CALM_ACTIONS)
  assert.ok(simplified.secondaryActions.length <= MAX_SECONDARY_CALM_ACTIONS)
  assert.ok(simplified.suppressedNoiseCount > 0)
  assert.ok(
    simplified.criticalActions.every((item) => !isCoordinatorHostileLanguage(item.label)),
  )

  const recovery = groupRecoveryActions({
    workflows: queueItems.map((item, index) => ({
      workflowId: `wf-${index}`,
      workflowLabel: item.label,
      priority: item.priority,
      recoveryKind: item.kind.includes('signature')
        ? 'signoff'
        : item.kind.includes('source')
          ? 'source'
          : 'blocked',
      nextStep: item.label,
    })),
    lastActiveWorkflowId: 'wf-2',
  })
  assert.equal(continueWhereLeftOff({
    workflows: recovery.primary,
    lastActiveWorkflowId: 'wf-2',
  })?.workflowId, 'wf-2')
  assert.ok(recovery.primary.length <= MAX_CRITICAL_CALM_ACTIONS)

  const confidence = deriveCoordinatorConfidenceSignals({
    runtimeId: 'visit-1',
    unsignedProcedureCount: 1,
    incompleteSourceCount: 0,
    unresolvedBlockerCount: 0,
    stabilizationComplete: false,
  })
  assert.ok(confidence.some((s) => s.category === 'immediate_action'))
  assert.ok(confidence.every((s) => s.visibility === 'site_internal_only'))
  assert.equal(assertNoSurveillanceMetrics(confidence), true)
  assert.equal(assertNoSurveillanceMetrics({ coordinator_score: 9 }), false)

  const friction = deriveCoordinatorFrictionProjection([
    {
      workflowId: 'capture-1',
      workflowLabel: 'Source capture',
      navigationRepeats: 3,
      unresolvedBlockerCount: 1,
      confusionReopenCount: 2,
    },
  ])
  const observation = deriveObservationProjection({
    observationSessionId: 'obs-1',
    startedAt: new Date().toISOString(),
    observerRole: 'site_observer',
    workflowContext: {
      workflowName: 'Source capture',
      attemptedAction: 'submit',
    },
    frictionEventsObserved: friction.events,
  })
  const recommendations = deriveCalmRefinementRecommendations({
    friction,
    observation,
    queueLabels: ['Protocol violation detected'],
  })
  assert.ok(recommendations.length > 0)
  assert.ok(recommendations.every((r) => r.visibility === 'site_internal_only'))
  assert.ok(
    recommendations.some((r) => r.kind === 'terminology_refinement'),
  )

  const externalDto = buildSourceReviewDto({
    response_set_id: 'rs-1',
    study_id: 'study-1',
    visit_label: 'V1',
    procedure_label: 'Vitals',
    fields: [{ field_label: 'Weight', submitted_value: 72 }],
  })
  assert.equal(JSON.stringify(externalDto).includes('site_internal_only'), false)
  assert.equal(JSON.stringify(externalDto).includes('likely_'), false)
  assert.equal(assertNoSurveillanceMetrics(externalDto), true)

  console.log('phase16g3-operational-calm-refinement-smoke: PASS')
}

main()
