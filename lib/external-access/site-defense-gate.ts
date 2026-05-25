/**
 * Site review + stabilization gate for external source review DTOs.
 * CRA/monitor only see evidence when runtime is finalized_for_external_review.
 */

import type { RuntimeStabilizationSummary } from '@/lib/site-defense/stabilization'
import {
  assertRuntimeStabilizedBeforeExposure,
  canReleaseForExternalReview,
  type SiteReviewReleaseInput,
} from '@/lib/site-defense/site-review'

export function isFinalizedForExternalReview(
  stabilization: RuntimeStabilizationSummary,
): boolean {
  return (
    stabilization.state === 'finalized_for_external_review'
    && stabilization.externalReviewAllowed
  )
}

export function canExposeSourceReviewDto(release: SiteReviewReleaseInput): boolean {
  return canReleaseForExternalReview(release)
}

export function assertSourceReviewDtoExposureAllowed(release: SiteReviewReleaseInput): void {
  assertRuntimeStabilizedBeforeExposure(release)
}
