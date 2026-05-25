import type { OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'
import type {
  SiteDefenseRiskInput,
  SiteDefenseSignal,
  SiteDefenseSignalName,
} from '@/lib/site-defense/signals'

export type PreventionQueueBucketName =
  | 'resolve_before_sdv'
  | 'high_deviation_risk'
  | 'signature_risk'
  | 'missing_source_continuity'
  | 'unresolved_escalation'
  | 'monitor_likely_finding'
  | 'inspection_risk'

export type PreventionQueueItem = {
  id: string
  bucket: PreventionQueueBucketName
  signal: SiteDefenseSignalName
  label: string
  nextAction: string
  priority: number
  actionKey: string
  source: string
}

export type PreventionQueueBucket = {
  bucket: PreventionQueueBucketName
  items: PreventionQueueItem[]
}

export type PreventionQueueInput = SiteDefenseRiskInput & {
  maxCoordinatorItems?: number
  signals?: SiteDefenseSignal[]
}

export type CoordinatorProtectionQueue = {
  items: OperationalWorkQueueItem[]
  hiddenNoiseCount: number
}
