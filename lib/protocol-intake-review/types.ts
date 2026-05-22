/**
 * Phase 12D — Human review workspace types (no runtime mutation).
 */
import type { ConfidenceLevel, EvidenceRef } from '@/lib/protocol-intake/types'

export type ReviewerStatus =
  | 'pending'
  | 'accepted'
  | 'edited'
  | 'rejected'
  | 'needs_clarification'

export type ReviewSectionId =
  | 'study_metadata'
  | 'visits'
  | 'procedures'
  | 'source_composition'
  | 'eligibility'
  | 'missing'
  | 'conflicts'
  | 'approval_summary'

export type ReviewFieldRow = {
  field_key: string
  label: string
  value: unknown
  original_extracted_value: unknown
  confidence?: ConfidenceLevel
  requires_human_review: boolean
  extraction_method?: string
  evidence_refs: EvidenceRef[]
}

export type ReviewableItem = {
  item_id: string
  section: ReviewSectionId
  title: string
  fields: ReviewFieldRow[]
  summary_labels: string[]
}

export type ReviewItemState = {
  item_id: string
  reviewer_status: ReviewerStatus
  evidence_insufficient: boolean
  edit_reason?: string
  field_overrides: Record<string, unknown>
  original_snapshot: Record<string, unknown>
  updated_at: string
}

export type SectionReviewState = {
  section: ReviewSectionId
  section_status: 'pending' | 'in_review' | 'approved'
  approved_at?: string
  approved_by?: string
}

export type ReviewAuditEntry = {
  item_id: string
  field_name: string
  original_value: unknown
  edited_value: unknown
  edit_reason: string
  reviewer_status: ReviewerStatus
  reviewer_id?: string
  timestamp: string
  evidence_refs: EvidenceRef[]
}

export type IntakeReviewSummary = {
  found: string[]
  needs_review: string[]
  missing: string[]
  conflicts: string[]
  recommended_source_sections: string[]
}

export type IntakePackageManifest = {
  draft_version?: string
  draft_id?: string
  study_key?: string
  protocol_id?: string
  input_files?: string[]
  review?: IntakeReviewSummary
  safety?: {
    auto_publish: boolean
    auto_bind: boolean
    runtime_mutation: boolean
    requires_human_approval?: boolean
  }
}

export type IntakeReviewPackage = {
  draft_key: string
  package_label: string
  package_path: string
  manifest: IntakePackageManifest
  items: ReviewableItem[]
  summary: IntakeReviewSummary
  source_documents: Array<{ file_name: string; file_type?: string }>
}

export type ReviewWorkspaceState = {
  draft_key: string
  items: Record<string, ReviewItemState>
  sections: Record<ReviewSectionId, SectionReviewState>
  audit: ReviewAuditEntry[]
  last_saved_at: string
}

export const REVIEW_SAFETY = {
  auto_publish: false,
  auto_bind: false,
  runtime_mutation: false,
  requires_human_approval: true,
} as const
