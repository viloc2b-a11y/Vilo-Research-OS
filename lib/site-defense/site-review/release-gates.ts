import type {
  ExternalReviewDto,
  ExternalReviewEvidence,
  SiteReviewReleaseInput,
} from '@/lib/site-defense/site-review/types'

export class RuntimeExposureBlockedError extends Error {
  constructor(message = 'Runtime must be stabilized before external exposure.') {
    super(message)
    this.name = 'RuntimeExposureBlockedError'
  }
}

export function requiresSiteReviewBeforeExternalRelease(input: SiteReviewReleaseInput): boolean {
  return !input.siteReviewCompleted || input.stabilization.state !== 'finalized_for_external_review'
}

export function canReleaseForExternalReview(input: SiteReviewReleaseInput): boolean {
  return (
    input.sourceFinalized
    && input.signaturesComplete
    && input.siteReviewCompleted
    && input.stabilizationComplete
    && input.stabilization.state === 'finalized_for_external_review'
    && input.stabilization.externalReviewAllowed
  )
}

export function assertRuntimeStabilizedBeforeExposure(input: SiteReviewReleaseInput): void {
  if (!canReleaseForExternalReview(input)) {
    throw new RuntimeExposureBlockedError()
  }
}

export function buildExternalReviewDto(
  input: SiteReviewReleaseInput,
  evidence: ExternalReviewEvidence[],
): ExternalReviewDto {
  if (!canReleaseForExternalReview(input)) {
    return {
      reviewStatus: 'not_available',
      evidence: [],
    }
  }

  return {
    reviewStatus: 'finalized_for_external_review',
    evidence: evidence.map((item) => ({
      evidenceId: item.evidenceId,
      sourcePackageId: item.sourcePackageId ?? null,
      procedureExecutionId: item.procedureExecutionId ?? null,
      finalizedAt: item.finalizedAt,
      signedAt: item.signedAt ?? null,
    })),
  }
}
