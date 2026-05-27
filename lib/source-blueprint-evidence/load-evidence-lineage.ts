import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import {
  mapSourceBlueprintEvidenceLineageRow,
  type SourceBlueprintEvidenceLineageRow,
} from './source-lineage-types'

export async function loadEvidenceLineage(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  evidenceId: string,
): Promise<SourceBlueprintEvidenceLineageRow[]> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('source_blueprint_evidence_lineage')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('evidence_id', evidenceId)
    .order('element_type', { ascending: true })
    .order('element_key', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapSourceBlueprintEvidenceLineageRow(row as Record<string, unknown>),
  )
}
