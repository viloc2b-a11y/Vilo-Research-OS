import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapDraftSuggestionRow,
  type ReviewDraftSuggestionInput,
  type SourceBlueprintDraftSuggestionRow,
} from './draft-suggestion-types'

export class DraftSuggestionReviewStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftSuggestionReviewStateError'
  }
}

export async function reviewDraftSuggestion(
  supabase: SupabaseClient,
  input: ReviewDraftSuggestionInput,
): Promise<SourceBlueprintDraftSuggestionRow> {
  const reviewedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('source_blueprint_draft_suggestions')
    .update({
      suggestion_status: input.suggestionStatus,
      reviewed_by: input.reviewerId,
      reviewed_at: reviewedAt,
      review_notes: input.reviewNotes ?? null,
    })
    .eq('id', input.suggestionId)
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to review draft suggestion')
  return mapDraftSuggestionRow(data as Record<string, unknown>)
}
