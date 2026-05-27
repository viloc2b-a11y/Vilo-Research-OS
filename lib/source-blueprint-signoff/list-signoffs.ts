import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import {
  mapSourceBlueprintSignoffRow,
  type SourceBlueprintDraftSignoffRow,
} from './signoff-types'

export async function listSourceBlueprintSignoffs(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<SourceBlueprintDraftSignoffRow[]> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('source_blueprint_draft_signoffs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('signed_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSourceBlueprintSignoffRow(row as Record<string, unknown>))
}

export async function loadSourceBlueprintSignoffById(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  signoffId: string,
): Promise<SourceBlueprintDraftSignoffRow | null> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('source_blueprint_draft_signoffs')
    .select('*')
    .eq('id', signoffId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapSourceBlueprintSignoffRow(data as Record<string, unknown>) : null
}
