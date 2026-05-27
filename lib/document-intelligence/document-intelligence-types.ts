import type { DocumentIntelligenceDomain } from './document-domain-mapper'

export type { DocumentIntelligenceDomain }

export const INTELLIGENCE_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
  ARCHIVED: 'archived',
  SUPERSEDED: 'superseded',
  QUARANTINE: 'quarantine',
} as const

export type IntelligenceStatus = (typeof INTELLIGENCE_STATUS)[keyof typeof INTELLIGENCE_STATUS]

export const EXTRACTION_STATUS = {
  PENDING: 'pending',
  EXTRACTING: 'extracting',
  EXTRACTED: 'extracted',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
} as const

export type ExtractionStatus = (typeof EXTRACTION_STATUS)[keyof typeof EXTRACTION_STATUS]

export const DOCUMENT_EMBEDDING_STATUS = {
  PENDING: 'pending',
  EMBEDDING: 'embedding',
  EMBEDDED: 'embedded',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
  SKIPPED: 'skipped',
} as const

export type DocumentEmbeddingStatus =
  (typeof DOCUMENT_EMBEDDING_STATUS)[keyof typeof DOCUMENT_EMBEDDING_STATUS]

export const CHUNK_EMBEDDING_STATUS = {
  PENDING: 'pending',
  EMBEDDED: 'embedded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const

export type ChunkEmbeddingStatus = (typeof CHUNK_EMBEDDING_STATUS)[keyof typeof CHUNK_EMBEDDING_STATUS]

export const INGESTION_RUN_STATUS = {
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial',
  UNSUPPORTED: 'unsupported',
} as const

export type IngestionRunStatus = (typeof INGESTION_RUN_STATUS)[keyof typeof INGESTION_RUN_STATUS]

export const CHUNK_TYPE = {
  TEXT: 'text',
  TABLE: 'table',
  HEADING: 'heading',
  SECTION: 'section',
  NOTE: 'note',
} as const

export type ChunkType = (typeof CHUNK_TYPE)[keyof typeof CHUNK_TYPE]

export type DocumentIntelligenceDocumentRow = {
  id: string
  organizationId: string
  studyId: string | null
  complianceDocumentId: string
  documentClassification: string
  intelligenceStatus: IntelligenceStatus
  extractionStatus: ExtractionStatus
  embeddingStatus: DocumentEmbeddingStatus
  sourceHash: string
  sourceFilename: string
  sourceMimeType: string
  language: string | null
  effectiveDate: string | null
  versionLabel: string | null
  documentFamilyId: string
  versionNumber: number
  supersedesIntelligenceDocumentId: string | null
  supersededByDocumentId: string | null
  supersededReason: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  activeReferenceSetBy: string | null
  activeReferenceSetAt: string | null
  activeReferenceReason: string | null
  quarantineReason: Record<string, unknown>
  classificationMetadata: Record<string, unknown>
  phiOverrideBy: string | null
  phiOverrideAt: string | null
  phiOverrideNotes: string | null
  metadata: Record<string, unknown>
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type DocumentIntelligenceChunkRow = {
  id: string
  organizationId: string
  studyId: string | null
  intelligenceDocumentId: string
  complianceDocumentId: string
  chunkIndex: number
  chunkText: string
  cleanChunkText: string
  chunkHash: string
  tokenEstimate: number | null
  pageNumber: number | null
  sectionCode: string | null
  sectionTitle: string | null
  chunkType: ChunkType
  embeddingModel: string | null
  embeddingStatus: ChunkEmbeddingStatus
  metadata: Record<string, unknown>
  createdAt: string
}

export type DocumentIntelligenceSearchResult = {
  chunkId: string
  documentId: string
  sourceFilename: string
  sectionTitle: string | null
  pageNumber: number | null
  snippet: string
  similarity: number | null
}

export type IngestComplianceDocumentInput = {
  organization_id: string
  compliance_document_id: string
  /** Required in K1 — single selected study scope (no cross-study ingest). */
  study_id: string
  domains?: string[] | null
}

export type IngestComplianceDocumentResult = {
  status: 'completed' | 'processing'
  idempotent: boolean
  alreadyReady: boolean
  intelligenceDocumentId: string
  ingestionRunId: string
  runStatus: IngestionRunStatus
  extractedChunkCount: number
  embeddedChunkCount: number
  failedChunkCount: number
  extractionStatus: ExtractionStatus
  embeddingStatus: DocumentEmbeddingStatus
  intelligenceStatus: IntelligenceStatus
  errorMessage: string | null
  appliedDomains: DocumentIntelligenceDomain[]
  classificationMetadata: Record<string, unknown> | null
  quarantined: boolean
}

export function mapIntelligenceDocumentRow(
  row: Record<string, unknown>,
): DocumentIntelligenceDocumentRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: row.study_id ? String(row.study_id) : null,
    complianceDocumentId: String(row.compliance_document_id),
    documentClassification: String(row.document_classification),
    intelligenceStatus: row.intelligence_status as IntelligenceStatus,
    extractionStatus: row.extraction_status as ExtractionStatus,
    embeddingStatus: row.embedding_status as DocumentEmbeddingStatus,
    sourceHash: String(row.source_hash),
    sourceFilename: String(row.source_filename),
    sourceMimeType: String(row.source_mime_type),
    language: row.language ? String(row.language) : null,
    effectiveDate: row.effective_date ? String(row.effective_date) : null,
    versionLabel: row.version_label ? String(row.version_label) : null,
    documentFamilyId: String(row.document_family_id ?? row.id),
    versionNumber: row.version_number != null ? Number(row.version_number) : 1,
    supersedesIntelligenceDocumentId: row.supersedes_intelligence_document_id
      ? String(row.supersedes_intelligence_document_id)
      : null,
    supersededByDocumentId: row.superseded_by_document_id
      ? String(row.superseded_by_document_id)
      : null,
    supersededReason: row.superseded_reason ? String(row.superseded_reason) : null,
    effectiveFrom: row.effective_from ? String(row.effective_from) : null,
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
    activeReferenceSetBy: row.active_reference_set_by
      ? String(row.active_reference_set_by)
      : null,
    activeReferenceSetAt: row.active_reference_set_at
      ? String(row.active_reference_set_at)
      : null,
    activeReferenceReason: row.active_reference_reason
      ? String(row.active_reference_reason)
      : null,
    quarantineReason: (row.quarantine_reason as Record<string, unknown>) ?? {},
    classificationMetadata: (row.classification_metadata as Record<string, unknown>) ?? {},
    phiOverrideBy: row.phi_override_by ? String(row.phi_override_by) : null,
    phiOverrideAt: row.phi_override_at ? String(row.phi_override_at) : null,
    phiOverrideNotes: row.phi_override_notes ? String(row.phi_override_notes) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapIntelligenceChunkRow(row: Record<string, unknown>): DocumentIntelligenceChunkRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: row.study_id ? String(row.study_id) : null,
    intelligenceDocumentId: String(row.intelligence_document_id),
    complianceDocumentId: String(row.compliance_document_id),
    chunkIndex: Number(row.chunk_index),
    chunkText: String(row.chunk_text),
    cleanChunkText: String(row.clean_chunk_text),
    chunkHash: String(row.chunk_hash),
    tokenEstimate: row.token_estimate != null ? Number(row.token_estimate) : null,
    pageNumber: row.page_number != null ? Number(row.page_number) : null,
    sectionCode: row.section_code ? String(row.section_code) : null,
    sectionTitle: row.section_title ? String(row.section_title) : null,
    chunkType: row.chunk_type as ChunkType,
    embeddingModel: row.embedding_model ? String(row.embedding_model) : null,
    embeddingStatus: row.embedding_status as ChunkEmbeddingStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}
