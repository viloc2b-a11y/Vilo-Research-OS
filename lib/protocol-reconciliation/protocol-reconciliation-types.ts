export const VISIT_RECONCILIATION_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
} as const

export type VisitReconciliationStatus =
  (typeof VISIT_RECONCILIATION_STATUS)[keyof typeof VISIT_RECONCILIATION_STATUS]

export const PROCEDURE_RECONCILIATION_STATUS = {
  NEEDS_REVIEW: 'needs_review',
  MATCHED: 'matched',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MANUAL_MAPPING_REQUIRED: 'manual_mapping_required',
} as const

export type ProcedureReconciliationStatus =
  (typeof PROCEDURE_RECONCILIATION_STATUS)[keyof typeof PROCEDURE_RECONCILIATION_STATUS]

export const RECONCILIATION_SOURCE = {
  CANDIDATE: 'candidate',
  MANUAL: 'manual',
  MODIFIED: 'modified',
} as const

export type ReconciliationSource = (typeof RECONCILIATION_SOURCE)[keyof typeof RECONCILIATION_SOURCE]

export const MATCHING_METHOD = {
  AUTO_STRING: 'auto_string',
  AUTO_EXACT_CODE: 'auto_exact_code',
  MANUAL: 'manual',
  NONE: 'none',
} as const

export type MatchingMethod = (typeof MATCHING_METHOD)[keyof typeof MATCHING_METHOD]

export const RECONCILIATION_EVENT_TYPE = {
  VISIT_CREATED: 'visit_reconciliation_created',
  VISIT_APPROVED: 'visit_reconciliation_approved',
  VISIT_REJECTED: 'visit_reconciliation_rejected',
  PROCEDURE_MATCH_SUGGESTED: 'procedure_match_suggested',
  PROCEDURE_APPROVED: 'procedure_reconciliation_approved',
  PROCEDURE_REJECTED: 'procedure_reconciliation_rejected',
  MANUAL_MAPPING_CREATED: 'manual_mapping_created',
  PROCEDURE_MAPPING_MODIFIED: 'procedure_mapping_modified',
  PROCEDURE_BULK_APPROVED: 'procedure_reconciliation_bulk_approved',
  PROCEDURE_BULK_REJECTED: 'procedure_reconciliation_bulk_rejected',
} as const

export type ReconciliationEventType =
  (typeof RECONCILIATION_EVENT_TYPE)[keyof typeof RECONCILIATION_EVENT_TYPE]

/**
 * Read-only extraction provenance for a reconciliation row, resolved by tracing
 * the row back to its extraction candidate + source section. Never editable.
 */
export type ReconciliationVisitEvidence = {
  sectionTitle: string | null
  sectionType: string | null
  extractedText: string | null
  candidateConfidence: number | null
}

export type ReconciliationProcedureEvidence = {
  extractedText: string | null
  candidateConfidence: number | null
  sectionTitle: string | null
  sectionType: string | null
}

export type ProtocolVisitReconciliationRow = {
  id: string
  organizationId: string
  protocolVersionId: string
  visitCandidateId: string | null
  visitCode: string
  visitName: string
  visitType: string | null
  studyDay: number | null
  windowBeforeDays: number | null
  windowAfterDays: number | null
  reconciliationStatus: VisitReconciliationStatus
  reconciliationSource: ReconciliationSource
  approvedBy: string | null
  approvedAt: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Read-only extraction provenance; populated by the workspace loader. */
  evidence?: ReconciliationVisitEvidence | null
}

export type ProtocolProcedureReconciliationRow = {
  id: string
  organizationId: string
  protocolVersionId: string
  procedureCandidateId: string | null
  visitReconciliationId: string | null
  procedureName: string
  procedureCategory: string | null
  matchedProcedureLibraryId: string | null
  matchedBlueprintVersionId: string | null
  matchConfidence: number | null
  matchingMethod: MatchingMethod
  reconciliationStatus: ProcedureReconciliationStatus
  reconciliationSource: ReconciliationSource
  required: boolean
  procedureOrder: number | null
  operationalOverrides: Record<string, unknown>
  approvedBy: string | null
  approvedAt: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Read-only extraction provenance; populated by the workspace loader. */
  evidence?: ReconciliationProcedureEvidence | null
}

export type ProtocolReconciliationEventRow = {
  id: string
  organizationId: string
  protocolVersionId: string
  visitReconciliationId: string | null
  procedureReconciliationId: string | null
  eventType: ReconciliationEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  stateHash: string
  metadata: Record<string, unknown>
}

export type ProcedureMatchSuggestion = {
  procedureId: string
  procedureCode: string
  procedureName: string
  blueprintVersionId: string | null
  confidence: number
  matchingMethod: MatchingMethod
}

export type ReconciliationWorkspaceSummary = {
  visitCount: number
  procedureCount: number
  visitsApproved: number
  visitsRejected: number
  visitsPending: number
  proceduresApproved: number
  proceduresRejected: number
  proceduresMatched: number
  proceduresNeedsReview: number
  eventCount: number
  completenessPercent: number
  readyForRuntimeGeneration: boolean
}

export type LoadedReconciliationWorkspace = {
  protocolVersionId: string
  organizationId: string
  versionLabel: string | null
  visitReconciliations: ProtocolVisitReconciliationRow[]
  procedureReconciliations: ProtocolProcedureReconciliationRow[]
  events: ProtocolReconciliationEventRow[]
  summary: ReconciliationWorkspaceSummary
}

export type CreateManualVisitInput = {
  organization_id: string
  protocol_version_id: string
  visit_code: string
  visit_name: string
  visit_type?: string | null
  study_day?: number | null
  window_before_days?: number | null
  window_after_days?: number | null
}

export type UpdateVisitReconciliationInput = {
  organization_id: string
  visit_code?: string
  visit_name?: string
  visit_type?: string | null
  study_day?: number | null
  window_before_days?: number | null
  window_after_days?: number | null
}

export type UpdateProcedureReconciliationInput = {
  organization_id: string
  procedure_name?: string
  procedure_category?: string | null
  required?: boolean
  procedure_order?: number | null
  visit_reconciliation_id?: string | null
}

export type CreateManualProcedureInput = {
  organization_id: string
  protocol_version_id: string
  visit_reconciliation_id?: string | null
  procedure_name: string
  procedure_category?: string | null
  required?: boolean
  procedure_order?: number | null
}

export type UpdateProcedureMappingInput = {
  organization_id: string
  matched_procedure_library_id: string
  matched_blueprint_version_id?: string | null
  procedure_name?: string
  procedure_category?: string | null
  visit_reconciliation_id?: string | null
  required?: boolean
  procedure_order?: number | null
  operational_overrides?: Record<string, unknown>
}

export function mapVisitReconciliationRow(row: Record<string, unknown>): ProtocolVisitReconciliationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    protocolVersionId: String(row.protocol_version_id),
    visitCandidateId: row.visit_candidate_id ? String(row.visit_candidate_id) : null,
    visitCode: String(row.visit_code),
    visitName: String(row.visit_name),
    visitType: row.visit_type ? String(row.visit_type) : null,
    studyDay: row.study_day === null || row.study_day === undefined ? null : Number(row.study_day),
    windowBeforeDays:
      row.window_before_days === null || row.window_before_days === undefined
        ? null
        : Number(row.window_before_days),
    windowAfterDays:
      row.window_after_days === null || row.window_after_days === undefined
        ? null
        : Number(row.window_after_days),
    reconciliationStatus: row.reconciliation_status as VisitReconciliationStatus,
    reconciliationSource: row.reconciliation_source as ReconciliationSource,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapProcedureReconciliationRow(
  row: Record<string, unknown>,
): ProtocolProcedureReconciliationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    protocolVersionId: String(row.protocol_version_id),
    procedureCandidateId: row.procedure_candidate_id ? String(row.procedure_candidate_id) : null,
    visitReconciliationId: row.visit_reconciliation_id ? String(row.visit_reconciliation_id) : null,
    procedureName: String(row.procedure_name),
    procedureCategory: row.procedure_category ? String(row.procedure_category) : null,
    matchedProcedureLibraryId: row.matched_procedure_library_id
      ? String(row.matched_procedure_library_id)
      : null,
    matchedBlueprintVersionId: row.matched_blueprint_version_id
      ? String(row.matched_blueprint_version_id)
      : null,
    matchConfidence:
      row.match_confidence === null || row.match_confidence === undefined
        ? null
        : Number(row.match_confidence),
    matchingMethod: row.matching_method as MatchingMethod,
    reconciliationStatus: row.reconciliation_status as ProcedureReconciliationStatus,
    reconciliationSource: row.reconciliation_source as ReconciliationSource,
    required: Boolean(row.required),
    procedureOrder:
      row.procedure_order === null || row.procedure_order === undefined ? null : Number(row.procedure_order),
    operationalOverrides: (row.operational_overrides ?? {}) as Record<string, unknown>,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapReconciliationEventRow(row: Record<string, unknown>): ProtocolReconciliationEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    protocolVersionId: String(row.protocol_version_id),
    visitReconciliationId: row.visit_reconciliation_id ? String(row.visit_reconciliation_id) : null,
    procedureReconciliationId: row.procedure_reconciliation_id
      ? String(row.procedure_reconciliation_id)
      : null,
    eventType: row.event_type as ReconciliationEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload ?? {}) as Record<string, unknown>,
    stateHash: String(row.state_hash),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }
}
