/**
 * Phase 16F-1 — Site Defense Runtime smoke.
 *
 * Validates internal finding-prevention signals, prevention queue derivation,
 * stabilization gates, site-review enforcement, external DTO minimization,
 * site-only replay review, and coordinator prevention prioritization.
 */
import assert from 'node:assert/strict'
import {
  RuntimeExposureBlockedError,
  assertRuntimeStabilizedBeforeExposure,
  buildExternalReviewDto,
  buildSiteOnlyReplayReview,
  canReleaseForExternalReview,
  deriveCoordinatorProtectionQueue,
  derivePreventionQueue,
  deriveRuntimeStabilizationState,
  deriveSiteDefenseSignals,
  flattenPreventionQueue,
  replayReviewHasOpenSiteWork,
  requiresSiteReviewBeforeExternalRelease,
  type SiteDefenseRiskInput,
} from '../lib/site-defense'
import { mapSiteDefensePreventionQueueToCoordinatorBucket } from '../lib/coordinator-operations'

function serialized(value: unknown): string {
  return JSON.stringify(value)
}

function assertNoExternalLeak(value: unknown) {
  const text = serialized(value)
  const forbidden = [
    'likely_',
    'site_internal_only',
    'source_integrity_mismatch',
    'unresolved_governance_blockers',
    'raw',
    'signal',
    'queue',
    'chronology',
    'remediation',
    'unresolvedBlockers',
    'unresolvedSourceContinuity',
  ]

  for (const term of forbidden) {
    assert.equal(text.includes(term), false, `external DTO leaked ${term}`)
  }
}

function main() {
  const riskyInput: SiteDefenseRiskInput = {
    runtimeId: 'phase16f1-risky-visit',
    unsignedProcedureCount: 2,
    incompleteSourceCount: 3,
    missingRequiredSourceFieldCount: 1,
    temporalConsistencyIssueCount: 1,
    staleWorkflowCount: 2,
    missingDelegationCoverageCount: 1,
    sourceIntegrityMismatchCount: 1,
    unresolvedGovernanceBlockerCount: 1,
  }

  const signals = deriveSiteDefenseSignals(riskyInput)
  const signalNames = new Set(signals.map((signal) => signal.name))

  assert.ok(signalNames.has('likely_monitor_query'))
  assert.ok(signalNames.has('likely_signature_finding'))
  assert.ok(signalNames.has('likely_sdv_mismatch'))
  assert.ok(signalNames.has('likely_source_finding'))
  assert.ok(signalNames.has('likely_deviation'))
  assert.ok(signals.every((signal) => signal.visibility === 'site_internal_only'))

  const preventionQueue = derivePreventionQueue({ ...riskyInput, signals })
  const bucketNames = new Set(preventionQueue.map((bucket) => bucket.bucket))
  assert.ok(bucketNames.has('resolve_before_sdv'))
  assert.ok(bucketNames.has('signature_risk'))
  assert.ok(bucketNames.has('high_deviation_risk'))
  assert.ok(bucketNames.has('missing_source_continuity'))
  assert.ok(bucketNames.has('unresolved_escalation'))
  assert.ok(bucketNames.has('monitor_likely_finding'))
  assert.ok(bucketNames.has('inspection_risk'))

  const flatQueue = flattenPreventionQueue(preventionQueue)
  const uniqueActionKeys = new Set(flatQueue.map((item) => `${item.bucket}:${item.actionKey}`))
  assert.equal(uniqueActionKeys.size, flatQueue.length)
  assert.equal(flatQueue[0].bucket, 'resolve_before_sdv')
  assert.ok(flatQueue[0].nextAction.toLowerCase().includes('sdv') || flatQueue[0].nextAction.toLowerCase().includes('stabilize'))

  const coordinatorQueue = deriveCoordinatorProtectionQueue({
    ...riskyInput,
    signals,
    maxCoordinatorItems: 5,
  })
  assert.equal(coordinatorQueue.items.length, 5)
  assert.ok(coordinatorQueue.hiddenNoiseCount > 0)
  assert.equal(coordinatorQueue.items[0].kind, 'resolve_before_sdv')

  const coordinatorBucket = mapSiteDefensePreventionQueueToCoordinatorBucket({
    ...riskyInput,
    signals,
  })
  assert.equal(coordinatorBucket.bucket, 'Finding prevention')
  assert.ok(coordinatorBucket.items.length <= 5)
  assert.equal(coordinatorBucket.items[0].kind, 'resolve_before_sdv')

  const riskyStabilization = deriveRuntimeStabilizationState({
    ...riskyInput,
    siteReviewed: false,
    sourceFinalized: false,
    signaturesComplete: false,
    stabilizationComplete: false,
  })
  assert.equal(riskyStabilization.state, 'unstable')
  assert.equal(riskyStabilization.externalReviewAllowed, false)

  const readyStabilization = deriveRuntimeStabilizationState({
    runtimeId: 'phase16f1-ready-visit',
    siteReviewed: true,
    sourceFinalized: true,
    signaturesComplete: true,
    stabilizationComplete: true,
  })
  assert.equal(readyStabilization.state, 'finalized_for_external_review')
  assert.equal(readyStabilization.externalReviewAllowed, true)

  const blockedRelease = {
    sourceFinalized: false,
    signaturesComplete: false,
    siteReviewCompleted: false,
    stabilizationComplete: false,
    stabilization: riskyStabilization,
  }
  assert.equal(requiresSiteReviewBeforeExternalRelease(blockedRelease), true)
  assert.equal(canReleaseForExternalReview(blockedRelease), false)
  assert.throws(
    () => assertRuntimeStabilizedBeforeExposure(blockedRelease),
    RuntimeExposureBlockedError,
  )

  const blockedDto = buildExternalReviewDto(blockedRelease, [])
  assert.equal(blockedDto.reviewStatus, 'not_available')
  assert.deepEqual(blockedDto.evidence, [])
  assertNoExternalLeak(blockedDto)

  const readyRelease = {
    sourceFinalized: true,
    signaturesComplete: true,
    siteReviewCompleted: true,
    stabilizationComplete: true,
    stabilization: readyStabilization,
  }
  assert.equal(requiresSiteReviewBeforeExternalRelease(readyRelease), false)
  assert.equal(canReleaseForExternalReview(readyRelease), true)
  assert.doesNotThrow(() => assertRuntimeStabilizedBeforeExposure(readyRelease))

  const externalDto = buildExternalReviewDto(readyRelease, [
    {
      evidenceId: 'evidence-16f1-001',
      sourcePackageId: 'source-package-16f1',
      procedureExecutionId: 'procedure-16f1',
      finalizedAt: '2026-05-25T18:00:00Z',
      signedAt: '2026-05-25T18:10:00Z',
    },
  ])
  assert.equal(externalDto.reviewStatus, 'finalized_for_external_review')
  assert.equal(externalDto.evidence.length, 1)
  assertNoExternalLeak(externalDto)

  const replayReview = buildSiteOnlyReplayReview({
    chronologyGaps: ['source captured before procedure completion'],
    unresolvedBlockers: ['signature pending'],
    remediationHistory: ['source package reopened for correction'],
    unresolvedSourceContinuity: ['required field missing'],
  })
  assert.equal(replayReview.visibility, 'site_internal_only')
  assert.equal(replayReviewHasOpenSiteWork(replayReview), true)
  assert.ok(serialized(replayReview).includes('unresolvedChronologyGaps'))
  assert.equal(serialized(externalDto).includes('unresolvedChronologyGaps'), false)

  console.log('phase16f1-site-defense-runtime-smoke: PASS')
  console.log(JSON.stringify({
    signals: signals.map((signal) => signal.name),
    queueBuckets: preventionQueue.map((bucket) => bucket.bucket),
    coordinatorVisibleItems: coordinatorQueue.items.length,
    coordinatorHiddenNoise: coordinatorQueue.hiddenNoiseCount,
    riskyState: riskyStabilization.state,
    readyState: readyStabilization.state,
    blockedExternalStatus: blockedDto.reviewStatus,
    releasedEvidenceCount: externalDto.evidence.length,
    replayVisibility: replayReview.visibility,
  }, null, 2))
}

main()
