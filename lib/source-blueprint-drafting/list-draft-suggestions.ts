import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import {
  mapDraftSuggestionRow,
  type ListDraftSuggestionsInput,
  type SourceBlueprintDraftSuggestionRow,
} from './draft-suggestion-types'

export async function listDraftSuggestions(
  supabase: SupabaseClient,
  input: ListDraftSuggestionsInput,
): Promise<SourceBlueprintDraftSuggestionRow[]> {
  assertK1SingleStudyScope(input.studyId)

  let query = supabase
    .from('source_blueprint_draft_suggestions')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .order('created_at', { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200))

  if (input.suggestionStatus) {
    query = query.eq('suggestion_status', input.suggestionStatus)
  }
  if (input.suggestionType) {
    query = query.eq('suggestion_type', input.suggestionType)
  }
  if (input.evidenceId) {
    query = query.eq('evidence_id', input.evidenceId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDraftSuggestionRow(row as Record<string, unknown>))
}

export async function loadDraftSuggestionById(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  suggestionId: string,
): Promise<SourceBlueprintDraftSuggestionRow | null> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('source_blueprint_draft_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapDraftSuggestionRow(data as Record<string, unknown>) : null
}
