export type {
  InternalRiskCategory,
  InternalRiskFinding,
  InternalRiskSeverity,
  RiskDetectionSnapshot,
} from '@/lib/site-defense/risk-detection'
export {
  detectInternalRisks,
  detectInternalRisksWithInput,
  snapshotToSiteDefenseRiskInput,
} from '@/lib/site-defense/risk-detection'

export { COORDINATOR_PROTECTION_RULES } from '@/lib/site-defense/coordinator-protection'

export type {
  SiteDefenseRiskInput,
  SiteDefenseSignal,
  SiteDefenseSignalName,
} from '@/lib/site-defense/signals'
export {
  dedupeSiteDefenseSignals,
  deriveSiteDefenseSignals,
} from '@/lib/site-defense/signals'

export type {
  CoordinatorProtectionQueue,
  PreventionQueueBucket,
  PreventionQueueBucketName,
  PreventionQueueInput,
  PreventionQueueItem,
} from '@/lib/site-defense/prevention-queue'
export {
  comparePreventionItems,
  dedupePreventionItems,
  deriveCoordinatorProtectionQueue,
  derivePreventionQueue,
  flattenPreventionQueue,
} from '@/lib/site-defense/prevention-queue'

export type {
  RuntimeStabilizationInput,
  RuntimeStabilizationState,
  RuntimeStabilizationSummary,
} from '@/lib/site-defense/stabilization'
export { deriveRuntimeStabilizationState } from '@/lib/site-defense/stabilization'

export type {
  ExternalReviewDto,
  ExternalReviewEvidence,
  SiteReviewReleaseInput,
} from '@/lib/site-defense/site-review'
export {
  RuntimeExposureBlockedError,
  assertRuntimeStabilizedBeforeExposure,
  buildExternalReviewDto,
  canReleaseForExternalReview,
  requiresSiteReviewBeforeExternalRelease,
} from '@/lib/site-defense/site-review'

export type {
  SiteOnlyReplayReview,
  SiteOnlyReplayReviewInput,
} from '@/lib/site-defense/replay-review'
export {
  buildSiteOnlyReplayReview,
  replayReviewHasOpenSiteWork,
} from '@/lib/site-defense/replay-review'
