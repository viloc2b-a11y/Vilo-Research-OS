import type { OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'
import type {
  CoordinatorFrictionEvent,
  CoordinatorRecoverySignal,
} from '@/lib/coordinator-friction'

export type CoordinatorClaritySignalName =
  | 'unclear_next_action'
  | 'repeated_help_needed'
  | 'unresolved_navigation_confusion'
  | 'blocker_not_understood'
  | 'terminology_confusion'
  | 'repeated_reopen_pattern'

export type ObservationWorkflowContext = {
  studyId?: string | null
  subjectId?: string | null
  visitId?: string | null
  workflowName: string
  attemptedAction: string
}

export type WorkflowRecoveryObservation = {
  abandonedAt?: string | null
  recoveredAt?: string | null
  requiredHumanExplanation?: boolean
  repeatedNavigationAwayCount?: number
  sourceReopenCount?: number
  recoveryWorked?: boolean
  recoveryNote?: string | null
}

export type LiveObservationSessionInput = {
  observationSessionId: string
  startedAt: string
  endedAt?: string | null
  observerRole: 'site_observer' | 'implementation_observer' | 'coordinator_peer' | 'site_lead'
  workflowContext: ObservationWorkflowContext
  frictionEventsObserved?: CoordinatorFrictionEvent[]
  recoveryEventsObserved?: CoordinatorRecoverySignal[]
  unresolvedConfusionPoints?: string[]
  coordinatorFeedbackNotes?: string[]
  operationalRiskObserved?: string[]
  recoveryObservation?: WorkflowRecoveryObservation
}

export type LiveObservationSession = {
  observation_session_id: string
  started_at: string
  ended_at: string | null
  observer_role: LiveObservationSessionInput['observerRole']
  workflow_context: ObservationWorkflowContext
  friction_events_observed: CoordinatorFrictionEvent[]
  recovery_events_observed: CoordinatorRecoverySignal[]
  unresolved_confusion_points: string[]
  coordinator_feedback_notes: string[]
  operational_risk_observed: string[]
  recovery_observation: WorkflowRecoveryObservation
  visibility: 'site_internal_only'
  purpose: 'ux_refinement_only'
}

export type CoordinatorClaritySignal = {
  name: CoordinatorClaritySignalName
  visibility: 'site_internal_only'
  nonPunitive: true
  refinementOnly: true
  reason: string
}

export type ObservationProjection = {
  visibility: 'site_internal_only'
  session: LiveObservationSession
  claritySignals: CoordinatorClaritySignal[]
}

export type ObservationQueueRefinementInput = {
  items: OperationalWorkQueueItem[]
  maxVisibleItems?: number
}

export type ObservationQueueRefinementResult = {
  items: OperationalWorkQueueItem[]
  suppressedLowValueCount: number
  collapsedDuplicateUrgencyCount: number
}
