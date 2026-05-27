import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from './document-intelligence-scope'
import {
  mapIntelligenceChunkRow,
  mapIntelligenceDocumentRow,
  type DocumentIntelligenceChunkRow,
  type DocumentIntelligenceDocumentRow,
} from './document-intelligence-types'

export type LoadedIntelligenceDocument = {
  document: DocumentIntelligenceDocumentRow
  chunks: DocumentIntelligenceChunkRow[]
  chunkCount: number
}

export async function loadIntelligenceDocument(
  supabase: SupabaseClient,
  organizationId: string,
  intelligenceDocumentId: string,
  studyId: string,
): Promise<LoadedIntelligenceDocument | null> {
  assertK1SingleStudyScope(studyId)

  const { data: doc, error: docError } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!doc) return null

  const mappedDoc = mapIntelligenceDocumentRow(doc as Record<string, unknown>)

  const { data: chunks, error: chunkError } = await supabase
    .from('document_intelligence_chunks')
    .select('*')
    .eq('intelligence_document_id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('chunk_index', { ascending: true })
    .limit(200)

  if (chunkError) throw new Error(chunkError.message)

  const mappedChunks = (chunks ?? []).map((row) =>
    mapIntelligenceChunkRow(row as Record<string, unknown>),
  )

  return {
    document: mappedDoc,
    chunks: mappedChunks,
    chunkCount: mappedChunks.length,
  }
}
