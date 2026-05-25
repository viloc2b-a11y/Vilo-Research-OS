import type { OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'

export type CoordinatorFrictionEventType =
  | 'repeated_navigation'
  | 'abandoned_flow'
  | 'unresolved_blocker'
  | 'repeated_submission_failure'
  | 'excessive_click_path'
  | 'repeated_open_without_completion'
  | 'stalled_source_completion'
  | 'workflow_return_loop'
  | 'unresolved_signature_delay'
  | 'confusion_reopen_pattern'

export type CoordinatorFrictionSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical_operational_friction'

export type CoordinatorRecoverySignalName =
  | 'coordinator_stuck_risk'
  | 'likely_workflow_abandonment'
  | 'excessive_navigation_pattern'
  | 'repeated_failed_resolution'
  | 'likely_operational_confusion'

export type CoordinatorFrictionObservation = {
  workflowId: string
  workflowLabel: string
  navigationRepeats?: number
  abandonedFlow?: boolean
  unresolvedBlockerCount?: number
  submissionFailureCount?: number
  clickPathLength?: number
  openWithoutCompletionCount?: number
  stalledSourceMinutes?: number
  workflowReturnCount?: number
  signatureDelayHours?: number
  confusionReopenCount?: number
  operationalContinuityRisk?: boolean
  coordinatorConfusionRisk?: boolean
  likelyWorkflowAbandonment?: boolean
}

export type CoordinatorFrictionEvent = {
  id: string
  type: CoordinatorFrictionEventType
  visibility: 'site_internal_only'
  workflowId: string
  workflowLabel: string
  severity: CoordinatorFrictionSeverity
  whyThisMatters: string
  whatBlocksCompletion: string
  whatShouldHappenNext: string
  whatMayHappenIfUnresolved: string
}

export type CoordinatorRecoverySignal = {
  name: CoordinatorRecoverySignalName
  visibility: 'site_internal_only'
  nonPunitive: true
  preventionOriented: true
  severity: CoordinatorFrictionSeverity
  reason: string
}

export type CoordinatorFrictionProjection = {
  visibility: 'site_internal_only'
  events: CoordinatorFrictionEvent[]
  recoverySignals: CoordinatorRecoverySignal[]
}

export type QueueRefinementInput = {
  items: OperationalWorkQueueItem[]
  maxVisibleItems?: number
}

export type QueueRefinementResult = {
  items: OperationalWorkQueueItem[]
  suppressedNoiseCount: number
  collapsedDuplicateCount: number
}
