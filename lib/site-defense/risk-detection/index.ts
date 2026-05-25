export type {
  InternalRiskCategory,
  InternalRiskFinding,
  InternalRiskSeverity,
  RiskDetectionSnapshot,
} from '@/lib/site-defense/risk-detection/types'

export {
  detectInternalRisks,
  detectInternalRisksWithInput,
  snapshotToSiteDefenseRiskInput,
} from '@/lib/site-defense/risk-detection/detect'
