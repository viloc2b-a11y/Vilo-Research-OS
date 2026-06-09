export const PROTOCOL_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  RUNTIME_MAPPING: 'runtime_mapping',
  READY_FOR_GENERATION: 'ready_for_generation',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

export type ProtocolStatus = (typeof PROTOCOL_STATUS)[keyof typeof PROTOCOL_STATUS]

export const EXTRACTION_STATUS = {
  PENDING: 'pending',
  EXTRACTING: 'extracting',
  REVIEW_REQUIRED: 'review_required',
  READY: 'ready',
  FAILED: 'failed',
} as const

export type ExtractionStatus = (typeof EXTRACTION_STATUS)[keyof typeof EXTRACTION_STATUS]

export const SECTION_TYPE = {
  SCHEDULE_OF_ACTIVITIES: 'schedule_of_activities',
  VISIT_SCHEDULE: 'visit_schedule',
  PROCEDURE_SECTION: 'procedure_section',
  ELIGIBILITY: 'eligibility',
  SAFETY: 'safety',
  LABS: 'labs',
  ENDPOINTS: 'endpoints',
  IP_MANAGEMENT: 'ip_management',
  STATISTICS: 'statistics',
  OTHER: 'other',
} as const

export type ProtocolSectionType = (typeof SECTION_TYPE)[keyof typeof SECTION_TYPE]

export const RECONCILIATION_STATUS = {
  UNREVIEWED: 'unreviewed',
  MATCHED: 'matched',
  MODIFIED: 'modified',
  REJECTED: 'rejected',
  APPROVED: 'approved',
} as const

export type ReconciliationStatus =
  (typeof RECONCILIATION_STATUS)[keyof typeof RECONCILIATION_STATUS]

export const REVIEW_TYPE = {
  OPERATIONAL: 'operational',
  PI_REVIEW: 'pi_review',
  QUALITY_REVIEW: 'quality_review',
  MONITOR_PREP: 'monitor_prep',
} as const

export type ProtocolReviewType = (typeof REVIEW_TYPE)[keyof typeof REVIEW_TYPE]

export type ProtocolRuntimeStudyRow = {
  id: string
  organizationId: string
  studyId: string | null
  protocolNumber: string
  protocolTitle: string
  sponsorName: string | null
  therapeuticArea: string | null
  phase: string | null
  indication: string | null
  protocolStatus: ProtocolStatus
  currentProtocolVersionId: string | null
  sourceDocumentId: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProtocolRuntimeVersionRow = {
  id: string
  protocolRuntimeStudyId: string
  versionLabel: string
  amendmentNumber: string | null
  versionDate: string | null
  sourceDocumentId: string
  rawText: Record<string, unknown>
  extractionStatus: ExtractionStatus
  extractionMetadata: Record<string, unknown>
  previousVersionId: string | null
  piAcceptanceSignatureRequestId: string | null
  piAcceptanceSignatureId: string | null
  piAcceptanceStatus: 'not_requested' | 'pending' | 'signed' | 'voided' | 'superseded'
  piAcceptedAt: string | null
  piAcceptedBy: string | null
  createdBy: string
  createdAt: string
}

export type ProtocolRuntimeSectionRow = {
  id: string
  protocolVersionId: string
  sectionCode: string | null
  sectionTitle: string
  sectionType: ProtocolSectionType
  sequenceOrder: number
  extractedText: string
  extractionConfidence: number | null
  requiresReview: boolean
  metadata: Record<string, unknown>
  createdAt: string
}

export type ProtocolRuntimeVisitCandidateRow = {
  id: string
  protocolVersionId: string
  visitCode: string | null
  visitName: string
  visitType: string | null
  studyDay: number | null
  windowBeforeDays: number | null
  windowAfterDays: number | null
  extractedFromSectionId: string | null
  confidenceScore: number | null
  reconciliationStatus: ReconciliationStatus
  metadata: Record<string, unknown>
  createdAt: string
}

export type ProtocolRuntimeProcedureCandidateRow = {
  id: string
  protocolVersionId: string
  visitCandidateId: string | null
  procedureName: string
  procedureCategory: string | null
  extractedText: string | null
  confidenceScore: number | null
  matchedProcedureLibraryId: string | null
  matchedBlueprintVersionId: string | null
  reconciliationStatus: ReconciliationStatus
  metadata: Record<string, unknown>
  createdAt: string
}

export type ProtocolRuntimeAmendmentLinkRow = {
  id: string
  protocolRuntimeStudyId: string
  previousProtocolVersionId: string
  newProtocolVersionId: string
  amendmentType: string
  amendmentSummary: string | null
  createdBy: string
  createdAt: string
}

export type CreateProtocolRuntimeStudyInput = {
  organization_id: string
  study_id?: string | null
  protocol_number: string
  protocol_title: string
  sponsor_name?: string | null
  therapeutic_area?: string | null
  phase?: string | null
  indication?: string | null
  source_document_id?: string | null
}

export type CreateProtocolVersionInput = {
  organization_id: string
  protocol_runtime_study_id: string
  version_label: string
  source_document_id: string
  amendment_number?: string | null
  version_date?: string | null
  previous_version_id?: string | null
}

export type CreateAmendmentLinkInput = {
  organization_id: string
  protocol_runtime_study_id: string
  previous_protocol_version_id: string
  new_protocol_version_id: string
  amendment_type?: string
  amendment_summary?: string | null
}

export type ExtractProtocolVersionResult = {
  version: ProtocolRuntimeVersionRow
  sectionCount: number
  visitCandidateCount: number
  procedureCandidateCount: number
}

export type LoadedProtocolRuntimeStudy = {
  study: ProtocolRuntimeStudyRow
  versions: ProtocolRuntimeVersionRow[]
  latestVersion: ProtocolRuntimeVersionRow | null
  extractionSummary: {
    versionId: string
    extractionStatus: ExtractionStatus
    sections: number
    visits: number
    procedures: number
  }[]
}

export type LoadedProtocolVersion = {
  studyProtocolStatus: ProtocolStatus
  version: ProtocolRuntimeVersionRow
  sections: ProtocolRuntimeSectionRow[]
  visitCandidates: ProtocolRuntimeVisitCandidateRow[]
  procedureCandidates: ProtocolRuntimeProcedureCandidateRow[]
  amendmentLinks: ProtocolRuntimeAmendmentLinkRow[]
}

export function mapProtocolRuntimeStudyRow(row: Record<string, unknown>): ProtocolRuntimeStudyRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: row.study_id ? String(row.study_id) : null,
    protocolNumber: String(row.protocol_number),
    protocolTitle: String(row.protocol_title),
    sponsorName: row.sponsor_name ? String(row.sponsor_name) : null,
    therapeuticArea: row.therapeutic_area ? String(row.therapeutic_area) : null,
    phase: row.phase ? String(row.phase) : null,
    indication: row.indication ? String(row.indication) : null,
    protocolStatus: row.protocol_status as ProtocolStatus,
    currentProtocolVersionId: row.current_protocol_version_id
      ? String(row.current_protocol_version_id)
      : null,
    sourceDocumentId: row.source_document_id ? String(row.source_document_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapProtocolRuntimeVersionRow(row: Record<string, unknown>): ProtocolRuntimeVersionRow {
  return {
    id: String(row.id),
    protocolRuntimeStudyId: String(row.protocol_runtime_study_id),
    versionLabel: String(row.version_label),
    amendmentNumber: row.amendment_number ? String(row.amendment_number) : null,
    versionDate: row.version_date ? String(row.version_date) : null,
    sourceDocumentId: String(row.source_document_id),
    rawText: (row.raw_text as Record<string, unknown>) ?? {},
    extractionStatus: row.extraction_status as ExtractionStatus,
    extractionMetadata: (row.extraction_metadata as Record<string, unknown>) ?? {},
    previousVersionId: row.previous_version_id ? String(row.previous_version_id) : null,
    piAcceptanceSignatureRequestId: row.pi_acceptance_signature_request_id
      ? String(row.pi_acceptance_signature_request_id)
      : null,
    piAcceptanceSignatureId: row.pi_acceptance_signature_id
      ? String(row.pi_acceptance_signature_id)
      : null,
    piAcceptanceStatus:
      row.pi_acceptance_status === 'pending' ||
      row.pi_acceptance_status === 'signed' ||
      row.pi_acceptance_status === 'voided' ||
      row.pi_acceptance_status === 'superseded'
        ? row.pi_acceptance_status
        : 'not_requested',
    piAcceptedAt: row.pi_accepted_at ? String(row.pi_accepted_at) : null,
    piAcceptedBy: row.pi_accepted_by ? String(row.pi_accepted_by) : null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

export function mapProtocolRuntimeSectionRow(row: Record<string, unknown>): ProtocolRuntimeSectionRow {
  return {
    id: String(row.id),
    protocolVersionId: String(row.protocol_version_id),
    sectionCode: row.section_code ? String(row.section_code) : null,
    sectionTitle: String(row.section_title),
    sectionType: row.section_type as ProtocolSectionType,
    sequenceOrder: Number(row.sequence_order),
    extractedText: String(row.extracted_text),
    extractionConfidence:
      row.extraction_confidence === null || row.extraction_confidence === undefined
        ? null
        : Number(row.extraction_confidence),
    requiresReview: Boolean(row.requires_review),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export function mapProtocolRuntimeVisitCandidateRow(
  row: Record<string, unknown>,
): ProtocolRuntimeVisitCandidateRow {
  return {
    id: String(row.id),
    protocolVersionId: String(row.protocol_version_id),
    visitCode: row.visit_code ? String(row.visit_code) : null,
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
    extractedFromSectionId: row.extracted_from_section_id
      ? String(row.extracted_from_section_id)
      : null,
    confidenceScore:
      row.confidence_score === null || row.confidence_score === undefined
        ? null
        : Number(row.confidence_score),
    reconciliationStatus: row.reconciliation_status as ReconciliationStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export function mapProtocolRuntimeProcedureCandidateRow(
  row: Record<string, unknown>,
): ProtocolRuntimeProcedureCandidateRow {
  return {
    id: String(row.id),
    protocolVersionId: String(row.protocol_version_id),
    visitCandidateId: row.visit_candidate_id ? String(row.visit_candidate_id) : null,
    procedureName: String(row.procedure_name),
    procedureCategory: row.procedure_category ? String(row.procedure_category) : null,
    extractedText: row.extracted_text ? String(row.extracted_text) : null,
    confidenceScore:
      row.confidence_score === null || row.confidence_score === undefined
        ? null
        : Number(row.confidence_score),
    matchedProcedureLibraryId: row.matched_procedure_library_id
      ? String(row.matched_procedure_library_id)
      : null,
    matchedBlueprintVersionId: row.matched_blueprint_version_id
      ? String(row.matched_blueprint_version_id)
      : null,
    reconciliationStatus: row.reconciliation_status as ReconciliationStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export function mapProtocolRuntimeAmendmentLinkRow(
  row: Record<string, unknown>,
): ProtocolRuntimeAmendmentLinkRow {
  return {
    id: String(row.id),
    protocolRuntimeStudyId: String(row.protocol_runtime_study_id),
    previousProtocolVersionId: String(row.previous_protocol_version_id),
    newProtocolVersionId: String(row.new_protocol_version_id),
    amendmentType: String(row.amendment_type),
    amendmentSummary: row.amendment_summary ? String(row.amendment_summary) : null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

