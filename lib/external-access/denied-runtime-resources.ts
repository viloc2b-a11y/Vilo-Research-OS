/**
 * Runtime intelligence resources denied to CRA/monitor external actors.
 * Site-internal operators use existing loaders; external routes must not query these.
 */

export const DENIED_RUNTIME_TABLE = {
  RUNTIME_TRACES: 'runtime_traces',
  EXECUTION_SPANS: 'execution_spans',
  WORKFLOW_TELEMETRY: 'workflow_telemetry_events',
  VISIT_ORCHESTRATION: 'visit_coordinator_orchestration_projections',
  SUBJECT_ORCHESTRATION: 'subject_coordinator_orchestration_projections',
  VISIT_AUTOMATION: 'visit_runtime_automation_projections',
  SUBJECT_AUTOMATION: 'subject_runtime_automation_projections',
  VISIT_READINESS: 'visit_readiness_projections',
  SUBJECT_RUNTIME: 'subject_runtime_projections',
  STUDY_EXECUTION: 'study_execution_projections',
  VISIT_FINANCIAL: 'visit_financial_runtime_projections',
  SUBJECT_FINANCIAL: 'subject_financial_runtime_projections',
  OPERATIONAL_INTELLIGENCE: 'operational_intelligence_projections',
} as const

export const DENIED_RUNTIME_TABLES = [
  DENIED_RUNTIME_TABLE.RUNTIME_TRACES,
  DENIED_RUNTIME_TABLE.EXECUTION_SPANS,
  DENIED_RUNTIME_TABLE.WORKFLOW_TELEMETRY,
  DENIED_RUNTIME_TABLE.VISIT_ORCHESTRATION,
  DENIED_RUNTIME_TABLE.SUBJECT_ORCHESTRATION,
  DENIED_RUNTIME_TABLE.VISIT_AUTOMATION,
  DENIED_RUNTIME_TABLE.SUBJECT_AUTOMATION,
  DENIED_RUNTIME_TABLE.VISIT_READINESS,
  DENIED_RUNTIME_TABLE.SUBJECT_RUNTIME,
  DENIED_RUNTIME_TABLE.STUDY_EXECUTION,
  DENIED_RUNTIME_TABLE.VISIT_FINANCIAL,
  DENIED_RUNTIME_TABLE.SUBJECT_FINANCIAL,
  DENIED_RUNTIME_TABLE.OPERATIONAL_INTELLIGENCE,
] as const

export type DeniedRuntimeTable = (typeof DENIED_RUNTIME_TABLES)[number]

/** API/resource paths that must not be mounted for external actors without site release. */
export const DENIED_RUNTIME_API_PREFIXES = [
  '/api/runtime-traces',
  '/command-center',
] as const
