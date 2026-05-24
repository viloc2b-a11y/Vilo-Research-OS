/**
 * Tables whose mutations should emit operational_events or run through approved RPCs.
 */

export const CLINICAL_EXECUTION_TABLES = [
  'visits',
  'procedure_executions',
  'source_response_sets',
  'source_response_validation_findings',
  'source_responses',
  'subject_adverse_events',
  'subject_workflow_actions',
  'visit_progress_notes',
  'study_subjects',
] as const

export type ClinicalExecutionTable = (typeof CLINICAL_EXECUTION_TABLES)[number]

/** Derived caches — mutations allowed without spine (rebuildable). */
export const DERIVED_PROJECTION_TABLES = [
  'visit_readiness_projections',
  'subject_runtime_projections',
  'study_execution_projections',
  'subject_safety_continuity_projections',
  'visit_safety_carryforward_projections',
  'governance_signals',
  'governance_capa_placeholders',
  'protocol_graph_publications',
  'protocol_graph_nodes',
  'protocol_graph_edges',
  'visit_operational_intelligence_projections',
  'subject_operational_intelligence_projections',
  'runtime_replay_artifacts',
  'runtime_projection_refresh_log',
] as const

export const SPINE_TABLE = 'operational_events' as const

export function isClinicalExecutionTable(table: string): boolean {
  return (CLINICAL_EXECUTION_TABLES as readonly string[]).includes(table)
}

export function isDerivedProjectionTable(table: string): boolean {
  return (DERIVED_PROJECTION_TABLES as readonly string[]).includes(table)
}
