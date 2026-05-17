/**
 * Phase 5.2 — Types for canonical Source read API payloads (RPC-shaped).
 */

export type SourceValuePayload = {
  value_type?: string
  value_text?: string | null
  value_number?: number | null
  value_boolean?: boolean | null
  value_date?: string | null
  value_datetime?: string | null
  value_json?: unknown
}

export type ResponseSetMetadata = {
  id: string
  organization_id: string
  study_id: string
  study_version_id: string | null
  study_subject_id: string
  visit_id: string
  procedure_execution_id: string
  source_definition_version_id: string
  status: string
  source_origin: string
  opened_by_user_id: string
  opened_at: string
  submitted_by_user_id: string | null
  submitted_at: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  signed_by_user_id: string | null
  signed_at: string | null
  locked_by_user_id: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export type FieldCurrentEffective = {
  response_id: string
  response_sequence: number
  is_submitted: boolean
  captured_at: string
  submitted_at: string | null
  originator_user_id: string
  originator_role: string
  supersedes_response_id: string | null
  value: SourceValuePayload | null
}

export type FieldHistoryEntry = {
  response_id: string
  response_sequence: number
  is_current: boolean
  is_submitted: boolean
  captured_at: string
  submitted_at: string | null
  originator_user_id: string
  originator_role: string
  supersedes_response_id: string | null
  correction_chain_root_id: string | null
  raw_value: SourceValuePayload | null
}

export type ResponseSetFieldRow = {
  source_field_id: string
  field_key: string
  widget_hint: string | null
  is_required: boolean
  current_effective: FieldCurrentEffective | null
  history: FieldHistoryEntry[]
}

export type ResponseSetCorrection = {
  correction_id: string
  correction_type: string
  correction_reason: string
  prior_value_reference: string
  corrected_at: string
  corrected_by_user_id: string
  superseded_response_id: string
  replacement_response_id: string
  source_field_id: string
  prior_value: SourceValuePayload | null
  corrected_value: SourceValuePayload | null
  operational_event_id: string | null
}

export type ResponseSetAddendum = {
  addendum_id: string
  introduced_source_field_id: string
  field_key: string | null
  late_entry_reason: string
  added_at: string
  added_by_user_id: string
  introduced_by_source_definition_version_id: string
  applied_to_source_definition_version_id: string
  response_id: string | null
  structured_payload: SourceValuePayload | null
  operational_event_id: string | null
}

export type FindingsSummaryCounts = {
  total: number
  open: number
  acknowledged: number
  resolved: number
  waived: number
  severity: { info: number; warning: number; error: number }
}

export type ResponseSetDetailData = {
  response_set: ResponseSetMetadata
  fields: ResponseSetFieldRow[]
  corrections: ResponseSetCorrection[]
  addenda: ResponseSetAddendum[]
  findings_summary: {
    active: Array<{
      finding_id: string
      finding_type: string
      severity: string
      rule_code: string
      message: string
      status: string
      response_id: string | null
      created_at: string
    }>
    counts: FindingsSummaryCounts
  }
  placeholders: Record<string, unknown>
  lineage: {
    immutable_append_only: boolean
    history_rpc: string
    chronology_ref: { organization_id: string; source_response_set_id: string }
  }
}

export type ManifestData = {
  source_response_set_id: string
  organization_id: string
  study_id: string
  status: string
  timestamps: Record<string, string | null>
  completeness: {
    required_fields_total: number
    required_fields_captured_current: number
    is_submitted: boolean
  }
  counts: Record<string, number>
  latest_activity: { occurred_at: string | null; event_kind: string | null }
  lineage_refs: Record<string, string | null>
  chronology_checksum: string | null
}

export type HistoryEvent = {
  occurred_at: string
  event_kind: string
  actor_user_id: string | null
  payload: Record<string, unknown>
}

export type HistoryData = {
  source_response_set_id: string
  organization_id: string
  study_id: string
  study_subject_id: string
  visit_id: string
  procedure_execution_id: string
  current_status: string
  event_count: number
  events: HistoryEvent[]
}

export type FindingLifecycleEvent = {
  event_id: string
  prior_status: string | null
  new_status: string
  actor_user_id: string
  reason: string | null
  occurred_at: string
  operational_event_id: string | null
}

export type FindingRow = {
  finding_id: string
  finding_type: string
  severity: string
  rule_code: string
  message: string
  status: string
  response_id: string | null
  source_field_id: string | null
  created_at: string
  resolved_by_user_id: string | null
  resolved_at: string | null
  resolution_reason: string | null
  lifecycle_events: FindingLifecycleEvent[]
}

export type FindingsListData = {
  source_response_set_id: string
  organization_id: string
  filters_applied: {
    active_only: boolean
    status: string | null
    severity: string | null
  }
  findings: FindingRow[]
  counts: { returned: number; total_in_set: number }
}

export type FindingsListFilters = {
  active_only?: boolean
  status?: string | null
  severity?: string | null
}
