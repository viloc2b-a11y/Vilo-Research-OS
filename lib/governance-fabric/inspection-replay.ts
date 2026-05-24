/**
 * Inspection replay readiness notes (Phase 4 — documentation contract, not a UI).
 *
 * Replay reconstructs coordinator-visible state from canonical sources in order:
 * 1. operational_events (immutable chronology)
 * 2. execution tables (visits, procedures, source_response_sets)
 * 3. subject_adverse_events (AE registry)
 * 4. subject_workflow_actions (queries, follow-ups)
 * 5. Derived caches (projections, safety continuity, governance_signals) — rebuildable
 */

export const INSPECTION_REPLAY_READINESS = {
  canonicalSources: [
    {
      table: 'operational_events',
      role: 'Immutable mutation chronology; anchor for "what happened when".',
    },
    {
      table: 'visits',
      role: 'Visit execution state, window_status, scheduling deviation context.',
    },
    {
      table: 'procedure_executions',
      role: 'Procedure completion and signature state.',
    },
    {
      table: 'source_response_sets',
      role: 'eSource capture lifecycle per procedure.',
    },
    {
      table: 'source_response_validation_findings',
      role: 'Finding governance bridge; open/acknowledged/resolved status.',
    },
    {
      table: 'subject_adverse_events',
      role: 'Coordinator AE registry; safety continuity source of truth.',
    },
    {
      table: 'subject_workflow_actions',
      role: 'Queries and operational workflow; linked by visit/procedure/source.',
    },
    {
      table: 'protocol_graph_publications',
      role: 'Versioned protocol orchestration snapshot at publish time.',
    },
  ],
  derivedRebuildable: [
    'visit_readiness_projections',
    'subject_safety_continuity_projections',
    'visit_safety_carryforward_projections',
    'governance_signals',
    'governance_capa_placeholders',
    'runtime_replay_artifacts',
    'visit_operational_intelligence_projections',
    'subject_operational_intelligence_projections',
  ],
  replayProcedure: [
    'Select study_version and active protocol_graph_publication_id.',
    'Filter operational_events by study_id, subject_id, visit_id, time range.',
    'Join execution rows referenced in event payloads (mutation.details).',
    'Recompute visit readiness + safety continuity + governance signals.',
    'Run rebuildVisitReplay / rebuildSubjectReplay for inspection-grade timelines.',
    'Compare recomputed blockers to persisted projection cache (drift check).',
  ],
  gaps: [
    'Not all mutations yet emit operational_events (Phase 1C partial coverage).',
    'Governance signal acknowledgement is not yet a first-class coordinator action.',
    'CAPA placeholders are not yet promotable to corrective actions.',
  ],
} as const
