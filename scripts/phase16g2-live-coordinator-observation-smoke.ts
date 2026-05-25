/**
 * Phase 16G-2 — Live Coordinator Observation smoke.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OperationalWorkQueueItem } from '../lib/coordinator-operations'
import {
  buildObservationExternalDto,
  buildRecoveryUxNote,
  deriveCoordinatorClaritySignals,
  deriveObservationProjection,
  refineObservationQueueClarity,
} from '../lib/coordinator-observation'
import { deriveCoordinatorFrictionEvents, deriveRecoverySignals } from '../lib/coordinator-friction'

function readDoc(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function containsExternalLeak(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase()
  return [
    'site_internal_only',
    'observation_session_id',
    'friction_events_observed',
    'claritysignals',
    'unclear_next_action',
    'repeated_help_needed',
    'unresolved_navigation_confusion',
    'blocker_not_understood',
    'terminology_confusion',
    'repeated_reopen_pattern',
    'coordinator scoring',
    'performance ranking',
    'behavioral surveillance',
  ].some((term) => text.includes(term))
}

function main() {
  const frictionEvents = deriveCoordinatorFrictionEvents([
    {
      workflowId: 'live-source-workflow',
      workflowLabel: 'Live source completion',
      navigationRepeats: 3,
      abandonedFlow: true,
      unresolvedBlockerCount: 1,
      openWithoutCompletionCount: 2,
      workflowReturnCount: 3,
      confusionReopenCount: 2,
      coordinatorConfusionRisk: true,
      likelyWorkflowAbandonment: true,
    },
  ])
  const recoverySignals = deriveRecoverySignals(frictionEvents)

  const projection = deriveObservationProjection({
    observationSessionId: 'obs-16g2-001',
    startedAt: '2026-05-25T19:00:00Z',
    endedAt: '2026-05-25T19:20:00Z',
    observerRole: 'implementation_observer',
    workflowContext: {
      studyId: 'study-001',
      subjectId: 'subject-001',
      visitId: 'visit-001',
      workflowName: 'Source completion',
      attemptedAction: 'Submit required source',
    },
    frictionEventsObserved: frictionEvents,
    recoveryEventsObserved: recoverySignals,
    unresolvedConfusionPoints: [
      'next action unclear',
      'blocker wording was not understood',
      'term in warning label created hesitation',
    ],
    coordinatorFeedbackNotes: [
      'I need help understanding this label',
      'What do I do next?',
    ],
    operationalRiskObserved: ['source continuity may stall'],
    recoveryObservation: {
      abandonedAt: 'source submit',
      recoveredAt: 'source draft',
      requiredHumanExplanation: true,
      repeatedNavigationAwayCount: 3,
      sourceReopenCount: 3,
      recoveryWorked: true,
      recoveryNote: 'Coordinator recovered after direct explanation.',
    },
  })

  assert.equal(projection.visibility, 'site_internal_only')
  assert.equal(projection.session.visibility, 'site_internal_only')
  assert.equal(projection.session.purpose, 'ux_refinement_only')
  assert.equal(projection.session.observation_session_id, 'obs-16g2-001')
  assert.ok(projection.session.friction_events_observed.length > 0)
  assert.ok(projection.session.recovery_events_observed.length > 0)
  assert.ok(projection.session.unresolved_confusion_points.length > 0)
  assert.ok(projection.session.coordinator_feedback_notes.length > 0)
  assert.ok(projection.session.operational_risk_observed.length > 0)

  const claritySignals = deriveCoordinatorClaritySignals(projection.session)
  const clarityNames = new Set(claritySignals.map((signal) => signal.name))
  assert.ok(clarityNames.has('unclear_next_action'))
  assert.ok(clarityNames.has('repeated_help_needed'))
  assert.ok(clarityNames.has('unresolved_navigation_confusion'))
  assert.ok(clarityNames.has('blocker_not_understood'))
  assert.ok(clarityNames.has('terminology_confusion'))
  assert.ok(clarityNames.has('repeated_reopen_pattern'))
  assert.ok(claritySignals.every((signal) => signal.visibility === 'site_internal_only'))
  assert.ok(claritySignals.every((signal) => signal.nonPunitive))
  assert.ok(claritySignals.every((signal) => signal.refinementOnly))

  const note = buildRecoveryUxNote(projection.session.recovery_observation)
  assert.ok(note.whatShouldHappenNext.includes('recovered workflow step'))
  assert.ok(note.howToRecover.includes('last successful recovery point'))
  assert.ok(note.whatBlocksCompletion.includes('explanation'))
  assert.ok(note.whatCanSafelyWait.includes('collapsed'))
  assert.ok(note.whatRisksEscalation.includes('signoff'))

  const queueItems: OperationalWorkQueueItem[] = [
    { label: 'FYI low value warning', kind: 'informational', priority: 95 },
    { label: 'Resolve unresolved blocker', kind: 'blocker', priority: 68 },
    { label: 'Resolve unresolved blocker', kind: 'blocker', priority: 66 },
    { label: 'Complete PI signoff', kind: 'signature_risk', priority: 70 },
    { label: 'Restore source continuity', kind: 'source_gap_risk', priority: 69 },
    { label: 'Warning: can wait note', kind: 'can_wait', priority: 80 },
  ]
  const refined = refineObservationQueueClarity({ items: queueItems, maxVisibleItems: 3 })
  assert.equal(refined.items.length, 3)
  assert.equal(refined.collapsedDuplicateUrgencyCount, 1)
  assert.ok(refined.suppressedLowValueCount >= 2)
  assert.equal(refined.items[0].label, 'Complete PI signoff')
  assert.ok(refined.items.some((item) => item.label === 'Restore source continuity'))
  assert.ok(refined.items.some((item) => item.label === 'Resolve unresolved blocker'))
  assert.equal(refined.items.some((item) => item.kind === 'informational'), false)

  const externalDto = buildObservationExternalDto()
  assert.equal(externalDto.reviewStatus, 'not_available')
  assert.equal(containsExternalLeak(externalDto), false)
  assert.equal(containsExternalLeak(projection), true)

  const trust = readDoc('docs/COORDINATOR_TRUST_PROTECTION.md')
  assert.ok(trust.includes('UX refinement only'))
  assert.ok(trust.includes('Operational friction is a system problem'))
  assert.ok(trust.includes('Do not create or infer'))

  const language = readDoc('docs/COORDINATOR_LANGUAGE_REFINEMENT.md')
  assert.ok(language.includes('readiness'))
  assert.ok(language.includes('continuity'))
  assert.ok(language.includes('prevention'))
  assert.ok(language.includes('recovery'))
  assert.ok(language.includes('stabilization'))

  const template = readDoc('docs/LIVE_COORDINATOR_OBSERVATION_TEMPLATE.md')
  for (const section of [
    'Workflow Attempted',
    'Hesitation Points',
    'Misunderstood Terminology',
    'Ignored Warnings',
    'Unnecessary Navigation',
    'Frustration Indicators',
    'Recovery Success',
    'Trust / Confidence Observations',
    'Simplification Opportunities',
  ]) {
    assert.ok(template.includes(section), `missing template section: ${section}`)
  }
  assert.ok(template.includes('Do not evaluate coordinator competence.'))

  const prohibitedRuntimeText = JSON.stringify(projection).toLowerCase()
  assert.equal(prohibitedRuntimeText.includes('coordinator scoring'), false)
  assert.equal(prohibitedRuntimeText.includes('productivity ranking'), false)
  assert.equal(prohibitedRuntimeText.includes('performance ranking'), false)
  assert.equal(prohibitedRuntimeText.includes('comparative coordinator analytics'), false)

  console.log('phase16g2-live-coordinator-observation-smoke: PASS')
  console.log(JSON.stringify({
    observationSessionId: projection.session.observation_session_id,
    claritySignals: claritySignals.map((signal) => signal.name),
    refinedQueueItems: refined.items.map((item) => item.label),
    collapsedDuplicateUrgencyCount: refined.collapsedDuplicateUrgencyCount,
    suppressedLowValueCount: refined.suppressedLowValueCount,
    externalVisibility: externalDto.reviewStatus,
  }, null, 2))
}

main()
