import type { ProtocolIntakeDocument } from '@/lib/protocol-intake/types'

/** Normalized text chunk ready for deterministic extractors. */
export type DocumentTextChunk = {
  chunk_id: string
  file_name: string
  page_or_sheet: string
  section_reference?: string
  text: string
}

export type NormalizedIntakeCorpus = {
  documents: ProtocolIntakeDocument[]
  chunks: DocumentTextChunk[]
  full_text: string
}

export function buildCorpus(
  documents: ProtocolIntakeDocument[],
  chunks: DocumentTextChunk[],
): NormalizedIntakeCorpus {
  return {
    documents,
    chunks,
    full_text: chunks.map((c) => c.text).join('\n\n'),
  }
}
