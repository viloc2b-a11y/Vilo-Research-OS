import type {
  LiveObservationSession,
  LiveObservationSessionInput,
} from '@/lib/coordinator-observation/types'

export function createLiveObservationSession(
  input: LiveObservationSessionInput,
): LiveObservationSession {
  return {
    observation_session_id: input.observationSessionId,
    started_at: input.startedAt,
    ended_at: input.endedAt ?? null,
    observer_role: input.observerRole,
    workflow_context: input.workflowContext,
    friction_events_observed: input.frictionEventsObserved ?? [],
    recovery_events_observed: input.recoveryEventsObserved ?? [],
    unresolved_confusion_points: input.unresolvedConfusionPoints ?? [],
    coordinator_feedback_notes: input.coordinatorFeedbackNotes ?? [],
    operational_risk_observed: input.operationalRiskObserved ?? [],
    recovery_observation: input.recoveryObservation ?? {},
    visibility: 'site_internal_only',
    purpose: 'ux_refinement_only',
  }
}

export function buildObservationExternalDto(): { reviewStatus: 'not_available' } {
  return {
    reviewStatus: 'not_available',
  }
}
