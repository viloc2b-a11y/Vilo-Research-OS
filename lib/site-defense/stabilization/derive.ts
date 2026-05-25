import type {
  RuntimeStabilizationInput,
  RuntimeStabilizationSummary,
} from '@/lib/site-defense/stabilization/types'

function count(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

export function deriveRuntimeStabilizationState(
  input: RuntimeStabilizationInput,
): RuntimeStabilizationSummary {
  const reasons: string[] = []

  if (count(input.sourceIntegrityMismatchCount) > 0) reasons.push('source_integrity_mismatch')
  if (count(input.temporalConsistencyIssueCount) > 0) reasons.push('temporal_consistency')
  if (count(input.unresolvedGovernanceBlockerCount) > 0) reasons.push('governance_blocker')
  if (count(input.unsignedProcedureCount) > 0) reasons.push('signature_incomplete')
  if (count(input.incompleteSourceCount) > 0) reasons.push('source_incomplete')
  if (count(input.staleWorkflowCount) > 0) reasons.push('stale_workflow')

  if (
    input.sourceFinalized
    && input.signaturesComplete
    && input.siteReviewed
    && input.stabilizationComplete
    && reasons.length === 0
  ) {
    return {
      state: 'finalized_for_external_review',
      externalReviewAllowed: true,
      reasons: [],
    }
  }

  if (reasons.some((reason) => reason === 'source_integrity_mismatch' || reason === 'temporal_consistency')) {
    return {
      state: 'unstable',
      externalReviewAllowed: false,
      reasons,
    }
  }

  if (reasons.length > 0 || !input.stabilizationComplete) {
    return {
      state: 'stabilizing',
      externalReviewAllowed: false,
      reasons: reasons.length > 0 ? reasons : ['stabilization_incomplete'],
    }
  }

  return {
    state: 'reviewed',
    externalReviewAllowed: false,
    reasons: input.siteReviewed ? ['not_finalized_for_external_review'] : ['site_review_required'],
  }
}
