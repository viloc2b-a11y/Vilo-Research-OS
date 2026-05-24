/**
 * OBS-1 — Runtime observability centralized constants (avoid string drift).
 */

export const RUNTIME_TRACE_TYPE = {
  WORKFLOW_EXECUTION: 'workflow_execution',
  COORDINATOR_ACTION: 'coordinator_action',
  AUTOMATION_RUN: 'automation_run',
  REPLAY_INSPECTION: 'replay_inspection',
  GOVERNANCE_SIGNAL: 'governance_signal',
  PROJECTION_REFRESH: 'projection_refresh',
  MUTATION_GATEWAY: 'mutation_gateway',
} as const

export const RUNTIME_TRACE_TYPES = [
  RUNTIME_TRACE_TYPE.WORKFLOW_EXECUTION,
  RUNTIME_TRACE_TYPE.COORDINATOR_ACTION,
  RUNTIME_TRACE_TYPE.AUTOMATION_RUN,
  RUNTIME_TRACE_TYPE.REPLAY_INSPECTION,
  RUNTIME_TRACE_TYPE.GOVERNANCE_SIGNAL,
  RUNTIME_TRACE_TYPE.PROJECTION_REFRESH,
  RUNTIME_TRACE_TYPE.MUTATION_GATEWAY,
] as const

export type RuntimeTraceType = (typeof RUNTIME_TRACE_TYPES)[number]

export const RUNTIME_TRACE_STATUS = {
  STARTED: 'started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  DEGRADED: 'degraded',
} as const

export const RUNTIME_TRACE_STATUSES = [
  RUNTIME_TRACE_STATUS.STARTED,
  RUNTIME_TRACE_STATUS.IN_PROGRESS,
  RUNTIME_TRACE_STATUS.COMPLETED,
  RUNTIME_TRACE_STATUS.FAILED,
  RUNTIME_TRACE_STATUS.CANCELLED,
  RUNTIME_TRACE_STATUS.DEGRADED,
] as const

export type RuntimeTraceStatus = (typeof RUNTIME_TRACE_STATUSES)[number]

export const EXECUTION_SPAN_TYPE = {
  ORCHESTRATION: 'orchestration',
  PROJECTION_COMPUTE: 'projection_compute',
  MUTATION_GATEWAY: 'mutation_gateway',
  CAPTURE: 'capture',
  AUTOMATION_EVAL: 'automation_eval',
  REPLAY_SEGMENT: 'replay_segment',
  GOVERNANCE_CHECK: 'governance_check',
  FINANCIAL_EVAL: 'financial_eval',
} as const

export const EXECUTION_SPAN_TYPES = [
  EXECUTION_SPAN_TYPE.ORCHESTRATION,
  EXECUTION_SPAN_TYPE.PROJECTION_COMPUTE,
  EXECUTION_SPAN_TYPE.MUTATION_GATEWAY,
  EXECUTION_SPAN_TYPE.CAPTURE,
  EXECUTION_SPAN_TYPE.AUTOMATION_EVAL,
  EXECUTION_SPAN_TYPE.REPLAY_SEGMENT,
  EXECUTION_SPAN_TYPE.GOVERNANCE_CHECK,
  EXECUTION_SPAN_TYPE.FINANCIAL_EVAL,
] as const

export type ExecutionSpanType = (typeof EXECUTION_SPAN_TYPES)[number]

export const EXECUTION_SPAN_STATUS = RUNTIME_TRACE_STATUS

export const EXECUTION_SPAN_STATUSES = RUNTIME_TRACE_STATUSES

export type ExecutionSpanStatus = RuntimeTraceStatus

export const WORKFLOW_TELEMETRY_TYPE = {
  TRACE_OPENED: 'trace_opened',
  TRACE_CLOSED: 'trace_closed',
  SPAN_OPENED: 'span_opened',
  SPAN_CLOSED: 'span_closed',
  AUTHORITY_RESOLVED: 'authority_resolved',
  BLOCKER_RECORDED: 'blocker_recorded',
  WARNING_RECORDED: 'warning_recorded',
  AUTOMATION_SIGNAL: 'automation_signal',
  REPLAY_MARKER: 'replay_marker',
  GOVERNANCE_SIGNAL: 'governance_signal',
} as const

export const WORKFLOW_TELEMETRY_TYPES = [
  WORKFLOW_TELEMETRY_TYPE.TRACE_OPENED,
  WORKFLOW_TELEMETRY_TYPE.TRACE_CLOSED,
  WORKFLOW_TELEMETRY_TYPE.SPAN_OPENED,
  WORKFLOW_TELEMETRY_TYPE.SPAN_CLOSED,
  WORKFLOW_TELEMETRY_TYPE.AUTHORITY_RESOLVED,
  WORKFLOW_TELEMETRY_TYPE.BLOCKER_RECORDED,
  WORKFLOW_TELEMETRY_TYPE.WARNING_RECORDED,
  WORKFLOW_TELEMETRY_TYPE.AUTOMATION_SIGNAL,
  WORKFLOW_TELEMETRY_TYPE.REPLAY_MARKER,
  WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
] as const

export type WorkflowTelemetryType = (typeof WORKFLOW_TELEMETRY_TYPES)[number]

/** Forbidden metadata keys for OBS-2 authority — use enum columns on runtime_traces instead. */
export const OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS = [
  'authorityName',
  'authorityLabel',
  'authorityDisplayName',
  'authorityTierName',
  'authorityDescription',
] as const

export function isRuntimeTraceType(value: string): value is RuntimeTraceType {
  return (RUNTIME_TRACE_TYPES as readonly string[]).includes(value)
}

export function isRuntimeTraceStatus(value: string): value is RuntimeTraceStatus {
  return (RUNTIME_TRACE_STATUSES as readonly string[]).includes(value)
}

export function isExecutionSpanType(value: string): value is ExecutionSpanType {
  return (EXECUTION_SPAN_TYPES as readonly string[]).includes(value)
}

export function isExecutionSpanStatus(value: string): value is ExecutionSpanStatus {
  return (EXECUTION_SPAN_STATUSES as readonly string[]).includes(value)
}

export function isWorkflowTelemetryType(value: string): value is WorkflowTelemetryType {
  return (WORKFLOW_TELEMETRY_TYPES as readonly string[]).includes(value)
}
