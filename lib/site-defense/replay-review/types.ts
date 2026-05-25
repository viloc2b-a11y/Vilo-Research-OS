export type SiteOnlyReplayReviewInput = {
  chronologyGaps?: string[]
  unresolvedBlockers?: string[]
  remediationHistory?: string[]
  unresolvedSourceContinuity?: string[]
}

export type SiteOnlyReplayReview = {
  visibility: 'site_internal_only'
  unresolvedChronologyGaps: string[]
  unresolvedBlockers: string[]
  remediationHistory: string[]
  unresolvedSourceContinuity: string[]
}
