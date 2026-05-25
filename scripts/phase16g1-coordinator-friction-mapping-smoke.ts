/**
 * Phase 16G-1 — Coordinator Friction Mapping smoke.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  deriveCoordinatorFrictionEvents,
  deriveCoordinatorFrictionProjection,
  deriveFrictionSeverity,
  deriveRecoverySignals,
  preventionUxNoteFor,
  refineCoordinatorFrictionQueue,
  type CoordinatorFrictionObservation,
} from '../lib/coordinator-friction'
import type { OperationalWorkQueueItem } from '../lib/coordinator-operations'

function containsForbiddenExternalTerms(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase()
  return [
    'site_internal_only',
    'coordinator_stuck_risk',
    'likely_workflow_abandonment',
    'excessive_navigation_pattern',
    'repeated_failed_resolution',
    'likely_operational_confusion',
    'friction',
    'scoring',
    'ranking',
    'surveillance',
  ].some((term) => text.includes(term))
}

function buildExternalSafeDto() {
  return {
    reviewStatus: 'not_available',
    evidence: [],
  }
}

function main() {
  const observations: CoordinatorFrictionObservation[] = [
    {
      workflowId: 'source-capture-visit-1',
      workflowLabel: 'Source capture',
      navigationRepeats: 4,
      abandonedFlow: true,
      unresolvedBlockerCount: 2,
      submissionFailureCount: 3,
      clickPathLength: 14,
      openWithoutCompletionCount: 3,
      stalledSourceMinutes: 75,
      workflowReturnCount: 4,
      signatureDelayHours: 52,
      confusionReopenCount: 3,
      operationalContinuityRisk: true,
      coordinatorConfusionRisk: true,
      likelyWorkflowAbandonment: true,
    },
  ]

  const events = deriveCoordinatorFrictionEvents(observations)
  const eventTypes = new Set(events.map((event) => event.type))
  assert.equal(events.length, 10)
  assert.ok(eventTypes.has('repeated_navigation'))
  assert.ok(eventTypes.has('abandoned_flow'))
  assert.ok(eventTypes.has('unresolved_blocker'))
  assert.ok(eventTypes.has('repeated_submission_failure'))
  assert.ok(eventTypes.has('excessive_click_path'))
  assert.ok(eventTypes.has('repeated_open_without_completion'))
  assert.ok(eventTypes.has('stalled_source_completion'))
  assert.ok(eventTypes.has('workflow_return_loop'))
  assert.ok(eventTypes.has('unresolved_signature_delay'))
  assert.ok(eventTypes.has('confusion_reopen_pattern'))
  assert.ok(events.every((event) => event.visibility === 'site_internal_only'))
  assert.ok(events.every((event) => event.severity === 'critical_operational_friction'))

  const severity = deriveFrictionSeverity(observations[0])
  assert.equal(severity, 'critical_operational_friction')

  const signals = deriveRecoverySignals(events)
  const signalNames = new Set(signals.map((signal) => signal.name))
  assert.ok(signalNames.has('coordinator_stuck_risk'))
  assert.ok(signalNames.has('likely_workflow_abandonment'))
  assert.ok(signalNames.has('excessive_navigation_pattern'))
  assert.ok(signalNames.has('repeated_failed_resolution'))
  assert.ok(signalNames.has('likely_operational_confusion'))
  assert.ok(signals.every((signal) => signal.visibility === 'site_internal_only'))
  assert.ok(signals.every((signal) => signal.nonPunitive))
  assert.ok(signals.every((signal) => signal.preventionOriented))

  const projection = deriveCoordinatorFrictionProjection(observations)
  assert.equal(projection.visibility, 'site_internal_only')
  assert.equal(projection.events.length, events.length)
  assert.equal(projection.recoverySignals.length, signals.length)

  const note = preventionUxNoteFor('stalled_source_completion')
  assert.ok(note.whyThisMatters.includes('Source completion'))
  assert.ok(note.whatBlocksCompletion.includes('source'))
  assert.ok(note.whatShouldHappenNext.includes('Resume'))
  assert.ok(note.whatMayHappenIfUnresolved.includes('query'))

  const queueItems: OperationalWorkQueueItem[] = [
    { label: 'FYI study note', kind: 'informational', priority: 90 },
    { label: 'Resolve source continuity', kind: 'source_gap_risk', priority: 70 },
    { label: 'Resolve source continuity', kind: 'source_gap_risk', priority: 60 },
    { label: 'Complete PI signoff', kind: 'signature_risk', priority: 65 },
    { label: 'Overdue blocker recovery', kind: 'escalation_risk', priority: 72 },
    { label: 'Can wait: archive note', kind: 'can_wait', priority: 45 },
  ]

  const refined = refineCoordinatorFrictionQueue({ items: queueItems, maxVisibleItems: 3 })
  assert.equal(refined.items.length, 3)
  assert.equal(refined.collapsedDuplicateCount, 1)
  assert.ok(refined.suppressedNoiseCount >= 2)
  assert.equal(refined.items[0].label, 'Complete PI signoff')
  assert.ok(refined.items.some((item) => item.label === 'Resolve source continuity'))
  assert.equal(refined.items.some((item) => item.kind === 'informational'), false)

  const externalDto = buildExternalSafeDto()
  assert.equal(containsForbiddenExternalTerms(externalDto), false)
  assert.equal(containsForbiddenExternalTerms(projection), true)

  const template = readFileSync(
    join(process.cwd(), 'docs', 'COORDINATOR_PILOT_FRICTION_LOG_TEMPLATE.md'),
    'utf8',
  )
  for (const section of [
    'Workflow Attempted',
    'Confusion Point',
    'Blocker',
    'Resolution Time',
    'Workaround Needed',
    'Terminology Confusion',
    'Unnecessary Clicks',
    'Emotional Frustration Indicator',
    'Suggested Simplification',
  ]) {
    assert.ok(template.includes(section), `missing template section: ${section}`)
  }
  assert.equal(template.toLowerCase().includes('score the coordinator'), true)

  console.log('phase16g1-coordinator-friction-mapping-smoke: PASS')
  console.log(JSON.stringify({
    frictionEvents: events.length,
    severity,
    recoverySignals: signals.map((signal) => signal.name),
    refinedQueueItems: refined.items.map((item) => item.label),
    collapsedDuplicateCount: refined.collapsedDuplicateCount,
    suppressedNoiseCount: refined.suppressedNoiseCount,
    externalVisibility: externalDto.reviewStatus,
  }, null, 2))
}

main()
