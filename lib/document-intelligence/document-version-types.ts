import type { DocumentIntelligenceDomain } from './document-domain-mapper'

export type DocumentIntelligenceActiveReferenceRow = {
  id: string
  organizationId: string
  studyId: string
  documentFamilyId: string
  domain: DocumentIntelligenceDomain
  intelligenceDocumentId: string
  isActiveReference: boolean
  activeReferenceSetBy: string | null
  activeReferenceSetAt: string
  activeReferenceReason: string | null
}

export type DocumentVersionSummary = {
  intelligenceDocumentId: string
  documentFamilyId: string
  versionNumber: number
  versionLabel: string | null
  sourceFilename: string
  sourceHash: string
  intelligenceStatus: string
  effectiveFrom: string | null
  effectiveTo: string | null
  supersededByDocumentId: string | null
  supersededReason: string | null
  createdAt: string
  isActiveReferenceForDomains: DocumentIntelligenceDomain[]
  availableDomains: DocumentIntelligenceDomain[]
}

export function mapActiveReferenceRow(
  row: Record<string, unknown>,
): DocumentIntelligenceActiveReferenceRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    documentFamilyId: String(row.document_family_id),
    domain: String(row.domain) as DocumentIntelligenceDomain,
    intelligenceDocumentId: String(row.intelligence_document_id),
    isActiveReference: row.is_active_reference !== false,
    activeReferenceSetBy: row.active_reference_set_by
      ? String(row.active_reference_set_by)
      : null,
    activeReferenceSetAt: String(row.active_reference_set_at),
    activeReferenceReason: row.active_reference_reason
      ? String(row.active_reference_reason)
      : null,
  }
}
