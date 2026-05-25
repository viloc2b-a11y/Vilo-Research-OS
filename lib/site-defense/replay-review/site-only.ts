import type {
  SiteOnlyReplayReview,
  SiteOnlyReplayReviewInput,
} from '@/lib/site-defense/replay-review/types'

export function buildSiteOnlyReplayReview(input: SiteOnlyReplayReviewInput): SiteOnlyReplayReview {
  return {
    visibility: 'site_internal_only',
    unresolvedChronologyGaps: input.chronologyGaps ?? [],
    unresolvedBlockers: input.unresolvedBlockers ?? [],
    remediationHistory: input.remediationHistory ?? [],
    unresolvedSourceContinuity: input.unresolvedSourceContinuity ?? [],
  }
}

export function replayReviewHasOpenSiteWork(review: SiteOnlyReplayReview): boolean {
  return (
    review.unresolvedChronologyGaps.length > 0
    || review.unresolvedBlockers.length > 0
    || review.unresolvedSourceContinuity.length > 0
  )
}
