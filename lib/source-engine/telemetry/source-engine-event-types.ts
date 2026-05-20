/**
 * Source Engine operational event types (append-only operational_events stream).
 */

export const SOURCE_ENGINE_EVENT_TYPES = {
  ENGINE_SNAPSHOT_GENERATED: 'engine_snapshot_generated',
  ENGINE_SNAPSHOT_FAILED: 'engine_snapshot_failed',
  ENGINE_SIGNATURE_BLOCKED: 'engine_signature_blocked',
  ENGINE_SIGNATURE_GATE_FAILED_CLOSED: 'engine_signature_gate_failed_closed',
  ENGINE_TASKS_MATERIALIZED: 'engine_tasks_materialized',
  ENGINE_TASK_MATERIALIZATION_SKIPPED: 'engine_task_materialization_skipped',
  ENGINE_FALLBACK_TEMPLATE_USED: 'engine_fallback_template_used',
  ENGINE_RUNTIME_STATE_APPLIED: 'engine_runtime_state_applied',
} as const

export type SourceEngineEventType =
  (typeof SOURCE_ENGINE_EVENT_TYPES)[keyof typeof SOURCE_ENGINE_EVENT_TYPES]
