import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import type { SourceBlueprintEvidenceLineageRow } from '@/lib/source-blueprint-evidence/source-lineage-types'

export const DRAFT_SUGGESTION_TYPE = {
  SOURCE_SECTION: 'source_section',
  SOURCE_FIELD: 'source_field',
  COMPLETION_GUIDANCE: 'completion_guidance',
  VALIDATION_RULE: 'validation_rule',
  SIGNATURE_PLACEHOLDER: 'signature_placeholder',
  OPERATIONAL_INSTRUCTION: 'operational_instruction',
} as const

export type DraftSuggestionType =
  (typeof DRAFT_SUGGESTION_TYPE)[keyof typeof DRAFT_SUGGESTION_TYPE]

export const DRAFT_SUGGESTION_STATUS = {
  DRAFT: 'draft',
  ACCEPTED_FOR_MANUAL_USE: 'accepted_for_manual_use',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
} as const

export type DraftSuggestionStatus =
  (typeof DRAFT_SUGGESTION_STATUS)[keyof typeof DRAFT_SUGGESTION_STATUS]

export type DraftSuggestionPayload = {
  title: string
  body: string
  sourceText: string
  evidenceSummary: string
  usageDomain: DocumentIntelligenceDomain
  lineage: Array<{
    elementType: string
    elementKey: string
    elementLabel: string | null
    traceOrigin: string
  }>
  manualUseOnly: true
  runtimeMutated: false
  publishedSourceMutated: false
  reconciliationMutated: false
}

export type SourceBlueprintDraftSuggestionRow = {
  id: string
  organizationId: string
  studyId: string
  evidenceId: string
  suggestionType: DraftSuggestionType
  suggestionPayload: DraftSuggestionPayload
  suggestionStatus: DraftSuggestionStatus
  createdBy: string | null
  createdAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  metadata: Record<string, unknown>
}

export type CreateDraftSuggestionsInput = {
  organizationId: string
  studyId: string
  usageDomain?: DocumentIntelligenceDomain | null
  evidenceIds?: string[] | null
  createdBy: string
}

export type ListDraftSuggestionsInput = {
  organizationId: string
  studyId: string
  suggestionStatus?: DraftSuggestionStatus | null
  suggestionType?: DraftSuggestionType | null
  evidenceId?: string | null
  limit?: number
}

export type ReviewDraftSuggestionInput = {
  organizationId: string
  studyId: string
  suggestionId: string
  reviewerId: string
  suggestionStatus: Extract<
    DraftSuggestionStatus,
    'accepted_for_manual_use' | 'rejected' | 'archived'
  >
  reviewNotes?: string | null
}

export const DRAFT_SUGGESTION_TYPE_LABELS: Record<DraftSuggestionType, string> = {
  source_section: 'Source section',
  source_field: 'Source field',
  completion_guidance: 'Completion guidance',
  validation_rule: 'Validation rule',
  signature_placeholder: 'Signature placeholder',
  operational_instruction: 'Operational instruction',
}

export function mapDraftSuggestionRow(
  row: Record<string, unknown>,
): SourceBlueprintDraftSuggestionRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    evidenceId: String(row.evidence_id),
    suggestionType: row.suggestion_type as DraftSuggestionType,
    suggestionPayload: row.suggestion_payload as DraftSuggestionPayload,
    suggestionStatus: row.suggestion_status as DraftSuggestionStatus,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewNotes: row.review_notes ? String(row.review_notes) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export function lineageForSuggestionPayload(lineage: SourceBlueprintEvidenceLineageRow[]) {
  return lineage.map((row) => ({
    elementType: row.elementType,
    elementKey: row.elementKey,
    elementLabel: row.elementLabel,
    traceOrigin: row.traceOrigin,
  }))
}
