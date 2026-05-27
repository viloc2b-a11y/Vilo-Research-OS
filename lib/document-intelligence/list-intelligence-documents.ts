import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from './document-intelligence-scope'
import {
  mapIntelligenceDocumentRow,
  type DocumentIntelligenceDocumentRow,
} from './document-intelligence-types'

export async function listIntelligenceDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<DocumentIntelligenceDocumentRow[]> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapIntelligenceDocumentRow(row as Record<string, unknown>))
}
