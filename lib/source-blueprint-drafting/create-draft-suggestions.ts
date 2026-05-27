import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import { EVIDENCE_STATUS } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import { listSourceBlueprintEvidence } from '@/lib/source-blueprint-evidence/list-source-blueprint-evidence'
import { loadEvidenceLineage } from '@/lib/source-blueprint-evidence/load-evidence-lineage'
import {
  DRAFT_SUGGESTION_STATUS,
  DRAFT_SUGGESTION_TYPE,
  lineageForSuggestionPayload,
  mapDraftSuggestionRow,
  type CreateDraftSuggestionsInput,
  type DraftSuggestionPayload,
  type DraftSuggestionType,
  type SourceBlueprintDraftSuggestionRow,
} from './draft-suggestion-types'

function suggestionTypesForEvidence(kind: string): DraftSuggestionType[] {
  switch (kind) {
    case 'visit_window':
    case 'timing_rule':
      return [DRAFT_SUGGESTION_TYPE.COMPLETION_GUIDANCE, DRAFT_SUGGESTION_TYPE.VALIDATION_RULE]
    case 'safety_workflow':
      return [DRAFT_SUGGESTION_TYPE.OPERATIONAL_INSTRUCTION, DRAFT_SUGGESTION_TYPE.VALIDATION_RULE]
    case 'source_drafting':
      return [DRAFT_SUGGESTION_TYPE.SOURCE_SECTION, DRAFT_SUGGESTION_TYPE.SOURCE_FIELD]
    case 'procedure_generation':
      return [DRAFT_SUGGESTION_TYPE.SOURCE_SECTION, DRAFT_SUGGESTION_TYPE.OPERATIONAL_INSTRUCTION]
    default:
      return [DRAFT_SUGGESTION_TYPE.OPERATIONAL_INSTRUCTION]
  }
}

function titleForSuggestion(type: DraftSuggestionType, evidenceTitle: string) {
  const base = evidenceTitle.trim() || 'Evidence-backed drafting aid'
  switch (type) {
    case DRAFT_SUGGESTION_TYPE.SOURCE_SECTION:
      return `Draft section: ${base}`
    case DRAFT_SUGGESTION_TYPE.SOURCE_FIELD:
      return `Draft field: ${base}`
    case DRAFT_SUGGESTION_TYPE.COMPLETION_GUIDANCE:
      return `Completion guidance: ${base}`
    case DRAFT_SUGGESTION_TYPE.VALIDATION_RULE:
      return `Validation rule: ${base}`
    case DRAFT_SUGGESTION_TYPE.SIGNATURE_PLACEHOLDER:
      return `Signature placeholder: ${base}`
    case DRAFT_SUGGESTION_TYPE.OPERATIONAL_INSTRUCTION:
      return `Operational instruction: ${base}`
  }
}

function bodyForSuggestion(type: DraftSuggestionType, summary: string, excerpt: string) {
  const basis = summary.trim() || excerpt.trim()
  switch (type) {
    case DRAFT_SUGGESTION_TYPE.SOURCE_SECTION:
      return `Consider a source section that captures: ${basis}`
    case DRAFT_SUGGESTION_TYPE.SOURCE_FIELD:
      return `Consider source field(s) to capture the data implied by: ${basis}`
    case DRAFT_SUGGESTION_TYPE.COMPLETION_GUIDANCE:
      return `Consider completion guidance for coordinator review: ${basis}`
    case DRAFT_SUGGESTION_TYPE.VALIDATION_RULE:
      return `Consider a validation rule that preserves this requirement: ${basis}`
    case DRAFT_SUGGESTION_TYPE.SIGNATURE_PLACEHOLDER:
      return `Consider whether a manual signature placeholder is needed for: ${basis}`
    case DRAFT_SUGGESTION_TYPE.OPERATIONAL_INSTRUCTION:
      return `Consider an operational instruction based on: ${basis}`
  }
}

export async function createDraftSuggestions(
  supabase: SupabaseClient,
  input: CreateDraftSuggestionsInput,
): Promise<SourceBlueprintDraftSuggestionRow[]> {
  assertK1SingleStudyScope(input.studyId)

  const mappedEvidence = await listSourceBlueprintEvidence(supabase, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    evidenceStatus: EVIDENCE_STATUS.MAPPED,
    usageDomain: input.usageDomain ?? null,
    limit: 200,
  })

  const evidenceIdSet = new Set((input.evidenceIds ?? []).filter(Boolean))
  const selectedEvidence = evidenceIdSet.size
    ? mappedEvidence.filter((evidence) => evidenceIdSet.has(evidence.id))
    : mappedEvidence

  if (evidenceIdSet.size && selectedEvidence.length !== evidenceIdSet.size) {
    throw new Error('Draft suggestions require mapped evidence in the selected study.')
  }

  const inserts: Record<string, unknown>[] = []

  for (const evidence of selectedEvidence) {
    const lineage = await loadEvidenceLineage(
      supabase,
      input.organizationId,
      input.studyId,
      evidence.id,
    )
    const lineagePayload = lineageForSuggestionPayload(lineage)

    for (const suggestionType of suggestionTypesForEvidence(evidence.evidenceKind)) {
      const payload: DraftSuggestionPayload = {
        title: titleForSuggestion(suggestionType, evidence.title),
        body: bodyForSuggestion(suggestionType, evidence.summary, evidence.excerptText),
        sourceText: evidence.excerptText,
        evidenceSummary: evidence.summary,
        usageDomain: evidence.usageDomain,
        lineage: lineagePayload,
        manualUseOnly: true,
        runtimeMutated: false,
        publishedSourceMutated: false,
        reconciliationMutated: false,
      }

      inserts.push({
        organization_id: input.organizationId,
        study_id: input.studyId,
        evidence_id: evidence.id,
        suggestion_type: suggestionType,
        suggestion_payload: payload,
        suggestion_status: DRAFT_SUGGESTION_STATUS.DRAFT,
        created_by: input.createdBy,
        metadata: {
          evidence_status: evidence.evidenceStatus,
          evidence_kind: evidence.evidenceKind,
          mapping_only: true,
          runtime_mutated: false,
          published_source_mutated: false,
          reconciliation_mutated: false,
        },
      })
    }
  }

  if (inserts.length === 0) return []

  const { data, error } = await supabase
    .from('source_blueprint_draft_suggestions')
    .insert(inserts)
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDraftSuggestionRow(row as Record<string, unknown>))
}
