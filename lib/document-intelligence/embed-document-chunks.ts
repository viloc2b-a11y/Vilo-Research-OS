import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CHUNK_EMBEDDING_STATUS,
  DOCUMENT_EMBEDDING_STATUS,
  type DocumentIntelligenceDocumentRow,
} from './document-intelligence-types'
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_MODEL,
  embedTexts,
  isEmbeddingAvailable,
  MAX_EMBED_CALLS_PER_RUN,
} from './openai-embeddings'
import { isIngestDeadlineExceeded } from './ingest-runtime'

export type EmbedDocumentChunksResult = {
  embeddedChunkCount: number
  failedChunkCount: number
  deadlineExceeded: boolean
  embeddingStatus:
    | typeof DOCUMENT_EMBEDDING_STATUS.EMBEDDED
    | typeof DOCUMENT_EMBEDDING_STATUS.SKIPPED
    | typeof DOCUMENT_EMBEDDING_STATUS.FAILED
    | typeof DOCUMENT_EMBEDDING_STATUS.EMBEDDING
  errorMessage: string | null
}

export type EmbedDocumentChunksOptions = {
  deadlineAtMs?: number
}

export async function embedDocumentChunks(
  supabase: SupabaseClient,
  intelligenceDocument: DocumentIntelligenceDocumentRow,
  options?: EmbedDocumentChunksOptions,
): Promise<EmbedDocumentChunksResult> {
  if (!isEmbeddingAvailable()) {
    await supabase
      .from('document_intelligence_documents')
      .update({
        embedding_status: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intelligenceDocument.id)

    await supabase
      .from('document_intelligence_chunks')
      .update({ embedding_status: CHUNK_EMBEDDING_STATUS.SKIPPED })
      .eq('intelligence_document_id', intelligenceDocument.id)
      .eq('embedding_status', CHUNK_EMBEDDING_STATUS.PENDING)

    return {
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      deadlineExceeded: false,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
      errorMessage: null,
    }
  }

  let chunkQuery = supabase
    .from('document_intelligence_chunks')
    .select('id, clean_chunk_text')
    .eq('organization_id', intelligenceDocument.organizationId)
    .eq('intelligence_document_id', intelligenceDocument.id)
    .eq('embedding_status', CHUNK_EMBEDDING_STATUS.PENDING)
    .order('chunk_index', { ascending: true })

  if (intelligenceDocument.studyId) {
    chunkQuery = chunkQuery.eq('study_id', intelligenceDocument.studyId)
  }

  const { data: pendingChunks, error } = await chunkQuery

  if (error) throw new Error(error.message)

  const chunks = (pendingChunks ?? []).filter((row) => String(row.clean_chunk_text ?? '').trim())
  if (chunks.length === 0) {
    await supabase
      .from('document_intelligence_documents')
      .update({
        embedding_status: DOCUMENT_EMBEDDING_STATUS.EMBEDDED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intelligenceDocument.id)

    return {
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      deadlineExceeded: false,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.EMBEDDED,
      errorMessage: null,
    }
  }

  const batchCount = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)
  if (batchCount > MAX_EMBED_CALLS_PER_RUN) {
    const message = `Chunk embedding limit exceeded (${chunks.length} chunks, max ${MAX_EMBED_CALLS_PER_RUN * EMBEDDING_BATCH_SIZE} per run)`
    await supabase
      .from('document_intelligence_documents')
      .update({
        embedding_status: DOCUMENT_EMBEDDING_STATUS.FAILED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intelligenceDocument.id)

    return {
      embeddedChunkCount: 0,
      failedChunkCount: chunks.length,
      deadlineExceeded: false,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.FAILED,
      errorMessage: message,
    }
  }

  await supabase
    .from('document_intelligence_documents')
    .update({
      embedding_status: DOCUMENT_EMBEDDING_STATUS.EMBEDDING,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceDocument.id)

  let embeddedChunkCount = 0
  let failedChunkCount = 0
  let lastError: string | null = null

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    if (options?.deadlineAtMs && isIngestDeadlineExceeded(options.deadlineAtMs)) {
      return {
        embeddedChunkCount,
        failedChunkCount,
        deadlineExceeded: true,
        embeddingStatus: DOCUMENT_EMBEDDING_STATUS.EMBEDDING,
        errorMessage: null,
      }
    }

    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
    const texts = batch.map((row) => String(row.clean_chunk_text))

    try {
      const embeddings = await embedTexts(texts)
      for (let j = 0; j < batch.length; j += 1) {
        const chunk = batch[j]
        const embedding = embeddings[j]
        if (!embedding?.length) {
          failedChunkCount += 1
          await supabase
            .from('document_intelligence_chunks')
            .update({ embedding_status: CHUNK_EMBEDDING_STATUS.FAILED })
            .eq('id', chunk.id)
          continue
        }

        const { error: updateError } = await supabase
          .from('document_intelligence_chunks')
          .update({
            embedding,
            embedding_model: EMBEDDING_MODEL,
            embedding_status: CHUNK_EMBEDDING_STATUS.EMBEDDED,
          })
          .eq('id', chunk.id)

        if (updateError) {
          failedChunkCount += 1
          lastError = updateError.message
        } else {
          embeddedChunkCount += 1
        }
      }
    } catch (err) {
      failedChunkCount += batch.length
      lastError = err instanceof Error ? err.message : 'Embedding batch failed'
      await supabase
        .from('document_intelligence_chunks')
        .update({ embedding_status: CHUNK_EMBEDDING_STATUS.FAILED })
        .in(
          'id',
          batch.map((row) => row.id),
        )
    }
  }

  const finalStatus =
    failedChunkCount > 0 && embeddedChunkCount > 0
      ? DOCUMENT_EMBEDDING_STATUS.FAILED
      : failedChunkCount > 0
        ? DOCUMENT_EMBEDDING_STATUS.FAILED
        : DOCUMENT_EMBEDDING_STATUS.EMBEDDED

  await supabase
    .from('document_intelligence_documents')
    .update({
      embedding_status: finalStatus === DOCUMENT_EMBEDDING_STATUS.FAILED && embeddedChunkCount > 0
        ? DOCUMENT_EMBEDDING_STATUS.FAILED
        : finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceDocument.id)

  return {
    embeddedChunkCount,
    failedChunkCount,
    deadlineExceeded: false,
    embeddingStatus: finalStatus,
    errorMessage: lastError,
  }
}
