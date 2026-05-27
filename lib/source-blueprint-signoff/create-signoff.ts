import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import { DRAFT_SUGGESTION_STATUS } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import { listDraftSuggestions } from '@/lib/source-blueprint-drafting/list-draft-suggestions'
import {
  mapSourceBlueprintSignoffRow,
  type CreateSourceBlueprintSignoffInput,
  type SourceBlueprintDraftSignoffRow,
} from './signoff-types'

export class SourceBlueprintSignoffStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceBlueprintSignoffStateError'
  }
}

export async function createSourceBlueprintSignoff(
  supabase: SupabaseClient,
  input: CreateSourceBlueprintSignoffInput,
): Promise<SourceBlueprintDraftSignoffRow> {
  assertK1SingleStudyScope(input.studyId)

  const suggestionIds = Array.from(new Set(input.suggestionIds.filter(Boolean)))
  if (suggestionIds.length === 0) {
    throw new SourceBlueprintSignoffStateError('At least one draft suggestion is required.')
  }
  if (input.signoffStatement.trim().length < 10) {
    throw new SourceBlueprintSignoffStateError('Sign-off statement must include reviewer intent.')
  }

  const suggestions = await listDraftSuggestions(supabase, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    suggestionStatus: DRAFT_SUGGESTION_STATUS.ACCEPTED_FOR_MANUAL_USE,
    limit: 200,
  })
  const selected = suggestions.filter((suggestion) => suggestionIds.includes(suggestion.id))

  if (selected.length !== suggestionIds.length) {
    throw new SourceBlueprintSignoffStateError(
      'Sign-off requires accepted-for-manual-use suggestions in the selected study.',
    )
  }

  const evidenceIds = Array.from(new Set(selected.map((suggestion) => suggestion.evidenceId)))
  const signedAt = new Date().toISOString()
  const signoffSnapshot = {
    signed_at: signedAt,
    suggestion_count: selected.length,
    evidence_count: evidenceIds.length,
    suggestions: selected.map((suggestion) => ({
      id: suggestion.id,
      evidence_id: suggestion.evidenceId,
      suggestion_type: suggestion.suggestionType,
      suggestion_status: suggestion.suggestionStatus,
      suggestion_payload: suggestion.suggestionPayload,
      reviewed_by: suggestion.reviewedBy,
      reviewed_at: suggestion.reviewedAt,
      review_notes: suggestion.reviewNotes,
    })),
    guardrails: {
      runtime_mutated: false,
      published_source_mutated: false,
      reconciliation_mutated: false,
      autonomous_generation: false,
    },
  }

  const { data, error } = await supabase
    .from('source_blueprint_draft_signoffs')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      signoff_status: 'signed',
      signoff_statement: input.signoffStatement.trim(),
      suggestion_ids: suggestionIds,
      evidence_ids: evidenceIds,
      signoff_snapshot: signoffSnapshot,
      signed_by: input.signedBy,
      signed_at: signedAt,
      metadata: {
        manual_review_complete: true,
        runtime_mutated: false,
        published_source_mutated: false,
        reconciliation_mutated: false,
      },
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create source blueprint sign-off')
  return mapSourceBlueprintSignoffRow(data as Record<string, unknown>)
}
