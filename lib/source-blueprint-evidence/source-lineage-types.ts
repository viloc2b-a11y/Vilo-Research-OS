export const LINEAGE_ELEMENT_TYPE = {
  SOURCE_SECTION: 'source_section',
  SOURCE_FIELD: 'source_field',
  SIGNATURE_PLACEHOLDER: 'signature_placeholder',
  COMPLETION_RULE: 'completion_rule',
  VALIDATION_RULE: 'validation_rule',
  OPERATIONAL_INSTRUCTION: 'operational_instruction',
} as const

export type LineageElementType = (typeof LINEAGE_ELEMENT_TYPE)[keyof typeof LINEAGE_ELEMENT_TYPE]

export const TRACE_ORIGIN = {
  PROCEDURE_BLUEPRINT: 'procedure_blueprint',
  RUNTIME_GRAPH: 'runtime_graph',
  PROTOCOL_EVIDENCE: 'protocol_evidence',
  CRF_GUIDANCE: 'crf_guidance',
  SOP_MANUAL_EVIDENCE: 'sop_manual_evidence',
  MANUAL_RECONCILIATION_DECISION: 'manual_reconciliation_decision',
} as const

export type TraceOrigin = (typeof TRACE_ORIGIN)[keyof typeof TRACE_ORIGIN]

export type LineageMappingInput = {
  elementType: LineageElementType
  elementKey: string
  elementLabel?: string | null
  traceOrigin: TraceOrigin
  coordinatorNotes?: string | null
}

export type BlueprintLineageCandidate = {
  elementType: LineageElementType
  elementKey: string
  elementLabel: string
  parentSectionId?: string | null
}

export type SourceBlueprintEvidenceLineageRow = {
  id: string
  organizationId: string
  studyId: string
  evidenceId: string
  blueprintVersionId: string
  elementType: LineageElementType
  elementKey: string
  elementLabel: string | null
  traceOrigin: TraceOrigin
  coordinatorNotes: string | null
  createdBy: string | null
  createdAt: string
}

export const LINEAGE_ELEMENT_LABELS: Record<LineageElementType, string> = {
  source_section: 'Source section',
  source_field: 'Source field',
  signature_placeholder: 'Signature placeholder',
  completion_rule: 'Completion rule',
  validation_rule: 'Validation rule',
  operational_instruction: 'Operational instruction',
}

export const TRACE_ORIGIN_LABELS: Record<TraceOrigin, string> = {
  procedure_blueprint: 'Procedure blueprint',
  runtime_graph: 'Runtime graph',
  protocol_evidence: 'Protocol evidence',
  crf_guidance: 'CRF guidance',
  sop_manual_evidence: 'SOP / manual evidence',
  manual_reconciliation_decision: 'Manual reconciliation decision',
}

export function mapSourceBlueprintEvidenceLineageRow(
  row: Record<string, unknown>,
): SourceBlueprintEvidenceLineageRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    evidenceId: String(row.evidence_id),
    blueprintVersionId: String(row.blueprint_version_id),
    elementType: row.element_type as LineageElementType,
    elementKey: String(row.element_key),
    elementLabel: row.element_label ? String(row.element_label) : null,
    traceOrigin: row.trace_origin as TraceOrigin,
    coordinatorNotes: row.coordinator_notes ? String(row.coordinator_notes) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
  }
}
