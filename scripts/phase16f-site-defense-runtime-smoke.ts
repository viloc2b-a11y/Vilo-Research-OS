/**
 * Phase 16F — Site Defense Runtime smoke.
 * Run: npx tsx scripts/phase16f-site-defense-runtime-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  assertSourceReviewDtoHasNoInternalRuntimeFields,
  buildSourceReviewDto,
  denyRuntimeIntelligenceAccess,
} from '../lib/external-access'
import type { OrganizationMembership } from '../lib/auth/session'
import {
  COORDINATOR_PROTECTION_RULES,
  detectInternalRisksWithInput,
  deriveCoordinatorProtectionQueue,
  derivePreventionQueue,
  deriveRuntimeStabilizationState,
  deriveSiteDefenseSignals,
  flattenPreventionQueue,
  type RiskDetectionSnapshot,
} from '../lib/site-defense'
import {
  assertSourceReviewDtoExposureAllowed,
  canExposeSourceReviewDto,
  isFinalizedForExternalReview,
} from '../lib/external-access/site-defense-gate'
import {
  assertRuntimeStabilizedBeforeExposure,
  buildExternalReviewDto,
  RuntimeExposureBlockedError,
} from '../lib/site-defense'
import { mapSiteDefensePreventionQueueToCoordinatorBucket } from '../lib/coordinator-operations'

function craMembership(): OrganizationMembership {
  return {
    organization_id: 'org-1',
    role: 'unblinded_cra',
    roles: ['unblinded_cra'],
    status: 'active',
    organizations: { id: 'org-1', name: 'Site' },
  }
}

function main() {
  const snapshot: RiskDetectionSnapshot = {
    runtimeId: 'visit-phase16f',
    unsignedProcedureCount: 2,
    staleWorkflowCount: 1,
    missingSignatureCount: 1,
    temporalInconsistencyCount: 1,
    sourceIntegrityMismatchCount: 1,
    unresolvedBlockerCount: 1,
    overdueSourceCompletionCount: 2,
    incompleteSourceCount: 1,
    piSignoffPendingCount: 1,
    coordinatorOpenItemCount: 12,
  }

  const { findings, riskInput } = detectInternalRisksWithInput(snapshot)
  assert.ok(findings.length >= 6)
  assert.ok(findings.every((f) => f.visibility === 'site_internal_only'))

  const signals = deriveSiteDefenseSignals(riskInput)
  const signalNames = new Set(signals.map((s) => s.name))
  assert.ok(signalNames.has('likely_monitor_query'))
  assert.ok(signalNames.has('likely_source_finding'))
  assert.ok(signalNames.has('likely_deviation'))
  assert.ok(signalNames.has('likely_signature_finding'))
  assert.ok(signalNames.has('likely_sdv_mismatch'))

  const queue = derivePreventionQueue({ ...riskInput, signals })
  const buckets = new Set(queue.map((b) => b.bucket))
  for (const expected of [
    'resolve_before_sdv',
    'high_deviation_risk',
    'signature_risk',
    'missing_source_continuity',
    'unresolved_escalation',
    'monitor_likely_finding',
    'inspection_risk',
  ] as const) {
    assert.ok(buckets.has(expected), `missing bucket ${expected}`)
  }

  const flat = flattenPreventionQueue(queue)
  assert.equal(flat[0].bucket, 'resolve_before_sdv')

  const protection = deriveCoordinatorProtectionQueue({
    ...riskInput,
    signals,
    maxCoordinatorItems: COORDINATOR_PROTECTION_RULES.maxVisibleActions,
  })
  assert.equal(protection.items.length, COORDINATOR_PROTECTION_RULES.maxVisibleActions)
  assert.ok(protection.hiddenNoiseCount > 0)

  const coordBucket = mapSiteDefensePreventionQueueToCoordinatorBucket({ ...riskInput, signals })
  assert.equal(coordBucket.bucket, 'Finding prevention')
  assert.equal(coordBucket.items[0].kind, 'resolve_before_sdv')

  const unstable = deriveRuntimeStabilizationState({
    ...riskInput,
    siteReviewed: false,
    sourceFinalized: false,
    signaturesComplete: false,
    stabilizationComplete: false,
  })
  assert.equal(unstable.state, 'unstable')
  assert.equal(isFinalizedForExternalReview(unstable), false)

  const finalized = deriveRuntimeStabilizationState({
    runtimeId: 'visit-ready',
    siteReviewed: true,
    sourceFinalized: true,
    signaturesComplete: true,
    stabilizationComplete: true,
  })
  assert.equal(finalized.state, 'finalized_for_external_review')
  assert.equal(isFinalizedForExternalReview(finalized), true)

  const blockedRelease = {
    sourceFinalized: false,
    signaturesComplete: false,
    siteReviewCompleted: false,
    stabilizationComplete: false,
    stabilization: unstable,
  }
  assert.equal(canExposeSourceReviewDto(blockedRelease), false)
  assert.throws(
    () => assertSourceReviewDtoExposureAllowed(blockedRelease),
    RuntimeExposureBlockedError,
  )
  assert.throws(
    () => assertRuntimeStabilizedBeforeExposure(blockedRelease),
    RuntimeExposureBlockedError,
  )

  const externalDto = buildExternalReviewDto(
    {
      sourceFinalized: true,
      signaturesComplete: true,
      siteReviewCompleted: true,
      stabilizationComplete: true,
      stabilization: finalized,
    },
    [{ evidenceId: 'e1', finalizedAt: '2026-05-25T12:00:00Z' }],
  )
  assert.equal(externalDto.reviewStatus, 'finalized_for_external_review')
  assert.equal(JSON.stringify(externalDto).includes('likely_'), false)

  const sourceDto = buildSourceReviewDto({
    response_set_id: 'rs-1',
    study_id: 'study-1',
    visit_label: 'V1',
    procedure_label: 'Labs',
    fields: [{ field_label: 'Result', submitted_value: 'normal' }],
  })
  const dtoGuard = assertSourceReviewDtoHasNoInternalRuntimeFields(sourceDto)
  assert.equal(dtoGuard.ok, true)
  const pollutedGuard = assertSourceReviewDtoHasNoInternalRuntimeFields({
    ...sourceDto,
    site_defense_signal: 'likely_monitor_query',
  })
  assert.equal(pollutedGuard.ok, false)

  assert.equal(
    denyRuntimeIntelligenceAccess({
      organizationId: 'org-1',
      studyId: 'study-1',
      memberships: [craMembership()],
      studyMemberRole: 'monitor',
    }),
    true,
  )

  console.log('phase16f-site-defense-runtime-smoke: PASS')
}

main()
