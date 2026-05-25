import type { SiteDefenseRiskInput } from '@/lib/site-defense/signals'

export type RuntimeStabilizationState =
  | 'unstable'
  | 'stabilizing'
  | 'reviewed'
  | 'finalized_for_external_review'

export type RuntimeStabilizationInput = SiteDefenseRiskInput & {
  siteReviewed?: boolean
  sourceFinalized?: boolean
  signaturesComplete?: boolean
  stabilizationComplete?: boolean
}

export type RuntimeStabilizationSummary = {
  state: RuntimeStabilizationState
  externalReviewAllowed: boolean
  reasons: string[]
}
