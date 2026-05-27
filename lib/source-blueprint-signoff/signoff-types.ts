import type { SourceBlueprintDraftSuggestionRow } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import type { SourceBlueprintEvidenceRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import type { SourceBlueprintEvidenceLineageRow } from '@/lib/source-blueprint-evidence/source-lineage-types'
import type { SourceBlueprintEvidenceReviewEventRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'

export const SOURCE_BLUEPRINT_SIGNOFF_STATUS = {
  SIGNED: 'signed',
  VOIDED: 'voided',
} as const

export type SourceBlueprintSignoffStatus =
  (typeof SOURCE_BLUEPRINT_SIGNOFF_STATUS)[keyof typeof SOURCE_BLUEPRINT_SIGNOFF_STATUS]

export type SourceBlueprintDraftSignoffRow = {
  id: string
  organizationId: string
  studyId: string
  signoffStatus: SourceBlueprintSignoffStatus
  signoffStatement: string
  suggestionIds: string[]
  evidenceIds: string[]
  signoffSnapshot: Record<string, unknown>
  signedBy: string | null
  signedAt: string
  voidedBy: string | null
  voidedAt: string | null
  voidReason: string | null
  metadata: Record<string, unknown>
}

export type SourceBlueprintAuditPackage = {
  packageType: 'source_blueprint_evidence_drafting_audit'
  packageVersion: 1
  generatedAt: string
  organizationId: string
  studyId: string
  signoff: SourceBlueprintDraftSignoffRow
  suggestions: SourceBlueprintDraftSuggestionRow[]
  evidence: SourceBlueprintEvidenceRow[]
  lineage: Record<string, SourceBlueprintEvidenceLineageRow[]>
  reviewEvents: Record<string, SourceBlueprintEvidenceReviewEventRow[]>
  guardrails: {
    runtimeMutated: false
    publishedSourceMutated: false
    reconciliationMutated: false
    autonomousGeneration: false
  }
}

export type SourceBlueprintAuditExportRow = {
  id: string
  organizationId: string
  studyId: string
  signoffId: string
  packageJson: SourceBlueprintAuditPackage
  packageHash: string
  generatedBy: string | null
  generatedAt: string
  metadata: Record<string, unknown>
}

export type CreateSourceBlueprintSignoffInput = {
  organizationId: string
  studyId: string
  suggestionIds: string[]
  signoffStatement: string
  signedBy: string
}

export type CreateSourceBlueprintAuditExportInput = {
  organizationId: string
  studyId: string
  signoffId: string
  generatedBy: string
}

export function mapSourceBlueprintSignoffRow(
  row: Record<string, unknown>,
): SourceBlueprintDraftSignoffRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    signoffStatus: row.signoff_status as SourceBlueprintSignoffStatus,
    signoffStatement: String(row.signoff_statement),
    suggestionIds: Array.isArray(row.suggestion_ids) ? row.suggestion_ids.map(String) : [],
    evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(String) : [],
    signoffSnapshot: (row.signoff_snapshot as Record<string, unknown>) ?? {},
    signedBy: row.signed_by ? String(row.signed_by) : null,
    signedAt: String(row.signed_at),
    voidedBy: row.voided_by ? String(row.voided_by) : null,
    voidedAt: row.voided_at ? String(row.voided_at) : null,
    voidReason: row.void_reason ? String(row.void_reason) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export function mapSourceBlueprintAuditExportRow(
  row: Record<string, unknown>,
): SourceBlueprintAuditExportRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    signoffId: String(row.signoff_id),
    packageJson: row.package_json as SourceBlueprintAuditPackage,
    packageHash: String(row.package_hash),
    generatedBy: row.generated_by ? String(row.generated_by) : null,
    generatedAt: String(row.generated_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
