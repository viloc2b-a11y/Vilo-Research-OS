/**
 * OBS-2 — Semantic hook signals stored in telemetry metadata.signal.
 */

export const OBS_HOOK_SIGNAL = {
  CLINICAL_MUTATION_EMITTED: 'clinical_mutation_emitted',
  SOURCE_RESPONSE_SET_OPENED: 'source_response_set_opened',
  SOURCE_DRAFT_SAVED: 'source_draft_saved',
  SOURCE_RESPONSE_SET_SUBMITTED: 'source_response_set_submitted',
  SOURCE_VALIDATION_FAILED: 'source_validation_failed',
  AUTOMATION_PROPOSED: 'automation_proposed',
  AUTOMATION_APPLIED: 'automation_applied',
  AUTOMATION_REVERSED: 'automation_reversed',
  AUTOMATION_OVERRIDDEN: 'automation_overridden',
  VISIT_READINESS_PROJECTION_REFRESHED: 'visit_readiness_projection_refreshed',
  SUBJECT_RUNTIME_PROJECTION_REFRESHED: 'subject_runtime_projection_refreshed',
  STUDY_EXECUTION_PROJECTION_REFRESHED: 'study_execution_projection_refreshed',
  VISIT_RUNTIME_UI_MODEL_LOADED: 'visit_runtime_ui_model_loaded',
  SUBJECT_RUNTIME_UI_MODEL_LOADED: 'subject_runtime_ui_model_loaded',
  TEMPORAL_CONSISTENCY_EVALUATED: 'temporal_consistency_evaluated',
  DELEGATION_RUNTIME_CHECKED: 'delegation_runtime_checked',
  BREAK_GLASS_ACCESS_REQUESTED: 'break_glass_access_requested',
  SOURCE_FIELD_SNAPSHOT_CAPTURED: 'source_field_snapshot_captured',
  SOURCE_INTEGRITY_VIOLATION_DETECTED: 'source_integrity_violation_detected',
  WORKFLOW_STALE_ALERT: 'workflow_stale_alert',
  ROLE_CONFLICT_DETECTED: 'role_conflict_detected',
} as const

export type ObsHookSignal = (typeof OBS_HOOK_SIGNAL)[keyof typeof OBS_HOOK_SIGNAL]

/** Phase 16A-2.5 compliance guardrail telemetry signals (subset of OBS_HOOK_SIGNAL). */
export const OBS_COMPLIANCE_HOOK_SIGNALS = [
  OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED,
  OBS_HOOK_SIGNAL.DELEGATION_RUNTIME_CHECKED,
  OBS_HOOK_SIGNAL.BREAK_GLASS_ACCESS_REQUESTED,
] as const

export type ObsComplianceHookSignal = (typeof OBS_COMPLIANCE_HOOK_SIGNALS)[number]

/** Phase 16A-2.6 pilot audit integrity telemetry signals. */
export const OBS_AUDIT_INTEGRITY_HOOK_SIGNALS = [
  OBS_HOOK_SIGNAL.SOURCE_FIELD_SNAPSHOT_CAPTURED,
  OBS_HOOK_SIGNAL.SOURCE_INTEGRITY_VIOLATION_DETECTED,
  OBS_HOOK_SIGNAL.WORKFLOW_STALE_ALERT,
  OBS_HOOK_SIGNAL.ROLE_CONFLICT_DETECTED,
] as const

export type ObsAuditIntegrityHookSignal = (typeof OBS_AUDIT_INTEGRITY_HOOK_SIGNALS)[number]
