import type { SupabaseClient } from '@supabase/supabase-js'
import {
  hashQueryText,
  sanitizeSearchQuery,
} from './document-hash-utils'
import { embedTexts, isEmbeddingAvailable } from './openai-embeddings'
import { assertK1SingleStudyScope } from './document-intelligence-scope'
import { isDocumentIntelligenceDomain } from './document-domain-mapper'
import type { DocumentIntelligenceDomain } from './document-intelligence-types'
import type { DocumentIntelligenceSearchResult } from './document-intelligence-types'

export type SearchDocumentIntelligenceInput = {
  organizationId: string
  /** K1: exactly one study per search — no cross-study queries. */
  studyId: string
  query: string
  /** When null/omitted, search all active domains for the study. */
  domain?: DocumentIntelligenceDomain | null
  documentClassification?: string | null
  limit?: number
  userId?: string | null
  /** When false (default), only active reference document versions are searched. */
  includeSuperseded?: boolean
}

function buildSnippet(text: string, max = 280): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

type RpcRow = {
  chunk_id: string
  intelligence_document_id: string
  compliance_document_id: string
  source_filename: string
  section_title: string | null
  page_number: number | null
  clean_chunk_text: string
  similarity: number | null
}

export async function searchDocumentIntelligence(
  supabase: SupabaseClient,
  input: SearchDocumentIntelligenceInput,
): Promise<DocumentIntelligenceSearchResult[]> {
  assertK1SingleStudyScope(input.studyId)

  const sanitized = sanitizeSearchQuery(input.query)
  if (!sanitized) return []

  const limit = Math.min(Math.max(input.limit ?? 8, 1), 25)
  const filterDomain =
    input.domain && isDocumentIntelligenceDomain(input.domain) ? input.domain : null
  let rows: RpcRow[] = []

  if (isEmbeddingAvailable()) {
    try {
      const [queryEmbedding] = await embedTexts([sanitized])
      if (queryEmbedding?.length) {
        const { data, error } = await supabase.rpc('match_document_intelligence_chunks', {
          query_embedding: queryEmbedding,
          match_count: limit,
          filter_organization_id: input.organizationId,
          filter_study_id: input.studyId,
          filter_classification: input.documentClassification ?? null,
          filter_domain: filterDomain,
          filter_include_superseded: input.includeSuperseded === true,
        })
        if (!error && data) {
          rows = data as RpcRow[]
        }
      }
    } catch {
      rows = []
    }
  }

  if (rows.length === 0) {
    const { data, error } = await supabase.rpc('keyword_search_document_intelligence_chunks', {
      search_query: sanitized,
      match_count: limit,
      filter_organization_id: input.organizationId,
      filter_study_id: input.studyId,
      filter_classification: input.documentClassification ?? null,
      filter_domain: filterDomain,
      filter_include_superseded: input.includeSuperseded === true,
    })
    if (error) throw new Error(error.message)
    rows = (data ?? []) as RpcRow[]
  }

  const results: DocumentIntelligenceSearchResult[] = rows.map((row) => ({
    chunkId: String(row.chunk_id),
    documentId: String(row.intelligence_document_id),
    sourceFilename: String(row.source_filename),
    sectionTitle: row.section_title ? String(row.section_title) : null,
    pageNumber: row.page_number != null ? Number(row.page_number) : null,
    snippet: buildSnippet(String(row.clean_chunk_text)),
    similarity: row.similarity != null ? Number(row.similarity) : null,
  }))

  await supabase.from('document_intelligence_search_events').insert({
    organization_id: input.organizationId,
    study_id: input.studyId,
    user_id: input.userId ?? null,
    query_text_hash: hashQueryText(sanitized),
    query_scope: {
      document_classification: input.documentClassification ?? null,
      domain: filterDomain,
      limit,
      include_superseded: input.includeSuperseded === true,
      mode: rows.length > 0 && isEmbeddingAvailable() ? 'vector_or_keyword' : 'keyword',
    },
    result_chunk_ids: results.map((result) => result.chunkId),
    result_count: results.length,
    metadata: {},
  })

  return results
}
