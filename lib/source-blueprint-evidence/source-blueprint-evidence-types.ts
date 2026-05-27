import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'

export const EVIDENCE_KIND = {
  PROCEDURE_GENERATION: 'procedure_generation',
  SOURCE_DRAFTING: 'source_drafting',
  TIMING_RULE: 'timing_rule',
  VISIT_WINDOW: 'visit_window',
  SAFETY_WORKFLOW: 'safety_workflow',
  BILLING_HINT: 'billing_hint',
  LAB_HANDLING: 'lab_handling',
} as const

export type EvidenceKind = (typeof EVIDENCE_KIND)[keyof typeof EVIDENCE_KIND]

export const EVIDENCE_STATUS = {
  PENDING_REVIEW: 'pending_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  MAPPED: 'mapped',
  ARCHIVED: 'archived',
  SUPERSEDED: 'superseded',
} as const

export type EvidenceStatus = (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS]

export const EVIDENCE_REVIEW_EVENT_TYPE = {
  EXTRACTED: 'extracted',
  SUBMITTED_FOR_REVIEW: 'submitted_for_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  MAPPING_PROPOSED: 'mapping_proposed',
  MAPPED: 'mapped',
  ARCHIVED: 'archived',
  SUPERSEDED: 'superseded',
} as const

export type EvidenceReviewEventType =
  (typeof EVIDENCE_REVIEW_EVENT_TYPE)[keyof typeof EVIDENCE_REVIEW_EVENT_TYPE]

export type SourceBlueprintEvidenceProvenance = {
  intelligence_document_id: string
  intelligence_chunk_id: string
  compliance_document_id: string
  source_document_version_id: string
  source_version_label: string | null
  source_version_number: number | null
  document_family_id: string
  chunk_index: number
  chunk_hash: string
  page_number: number | null
  section_title: string | null
  section_code: string | null
  source_filename: string
  usage_domain: DocumentIntelligenceDomain
  extraction_method: string
  extracted_at: string
}

export type SourceBlueprintEvidenceRow = {
  id: string
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  intelligenceChunkId: string
  complianceDocumentId: string
  usageDomain: DocumentIntelligenceDomain
  evidenceKind: EvidenceKind
  evidenceStatus: EvidenceStatus
  title: string
  summary: string
  excerptText: string
  structuredPayload: Record<string, unknown>
  provenance: SourceBlueprintEvidenceProvenance
  confidenceScore: number | null
  mappedProcedureLibraryId: string | null
  mappedBlueprintVersionId: string | null
  mappingNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export type SourceBlueprintEvidenceReviewEventRow = {
  id: string
  organizationId: string
  studyId: string
  evidenceId: string
  eventType: EvidenceReviewEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  metadata: Record<string, unknown>
}

export function mapSourceBlueprintEvidenceRow(
  row: Record<string, unknown>,
): SourceBlueprintEvidenceRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    intelligenceDocumentId: String(row.intelligence_document_id),
    intelligenceChunkId: String(row.intelligence_chunk_id),
    complianceDocumentId: String(row.compliance_document_id),
    usageDomain: String(row.usage_domain) as DocumentIntelligenceDomain,
    evidenceKind: row.evidence_kind as EvidenceKind,
    evidenceStatus: row.evidence_status as EvidenceStatus,
    title: String(row.title),
    summary: String(row.summary),
    excerptText: String(row.excerpt_text),
    structuredPayload: (row.structured_payload as Record<string, unknown>) ?? {},
    provenance: (row.provenance as SourceBlueprintEvidenceProvenance) ?? {
      intelligence_document_id: String(row.intelligence_document_id),
      intelligence_chunk_id: String(row.intelligence_chunk_id),
      compliance_document_id: String(row.compliance_document_id),
      source_document_version_id: String(row.intelligence_document_id),
      source_version_label: null,
      source_version_number: null,
      document_family_id: '',
      chunk_index: 0,
      chunk_hash: '',
      page_number: null,
      section_title: null,
      section_code: null,
      source_filename: '',
      usage_domain: String(row.usage_domain) as DocumentIntelligenceDomain,
      extraction_method: 'unknown',
      extracted_at: String(row.created_at),
    },
    confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : null,
    mappedProcedureLibraryId: row.mapped_procedure_library_id
      ? String(row.mapped_procedure_library_id)
      : null,
    mappedBlueprintVersionId: row.mapped_blueprint_version_id
      ? String(row.mapped_blueprint_version_id)
      : null,
    mappingNotes: row.mapping_notes ? String(row.mapping_notes) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  procedure_generation: 'Procedure generation',
  source_drafting: 'Source drafting',
  timing_rule: 'Timing rules',
  visit_window: 'Visit windows',
  safety_workflow: 'Safety workflows',
  billing_hint: 'Billing hints',
  lab_handling: 'Lab handling',
}
