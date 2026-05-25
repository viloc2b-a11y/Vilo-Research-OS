import type { RuntimeStabilizationSummary } from '@/lib/site-defense/stabilization'

export type SiteReviewReleaseInput = {
  sourceFinalized: boolean
  signaturesComplete: boolean
  siteReviewCompleted: boolean
  stabilizationComplete: boolean
  stabilization: RuntimeStabilizationSummary
}

export type ExternalReviewEvidence = {
  evidenceId: string
  sourcePackageId?: string | null
  procedureExecutionId?: string | null
  finalizedAt: string
  signedAt?: string | null
}

export type ExternalReviewDto = {
  reviewStatus: 'not_available' | 'finalized_for_external_review'
  evidence: ExternalReviewEvidence[]
}
