import { hashChunkText } from './document-hash-utils'
import { cleanDocumentText } from './document-text-cleaner'
import type { ChunkType } from './document-intelligence-types'

export type DocumentChunkDraft = {
  chunkIndex: number
  chunkText: string
  cleanChunkText: string
  chunkHash: string
  tokenEstimate: number
  pageNumber: number | null
  sectionCode: string | null
  sectionTitle: string | null
  chunkType: ChunkType
}

const TARGET_CHUNK_SIZE = 800
const CHUNK_OVERLAP = 120
const HEADING_PATTERN = /^(#{1,6}\s+.+|[A-Z][A-Z0-9\s\-]{4,}:?)$/m

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function detectSectionTitle(block: string): string | null {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
  const first = lines[0]
  if (!first) return null
  if (first.startsWith('#')) return first.replace(/^#+\s*/, '').slice(0, 200)
  if (HEADING_PATTERN.test(first) && first.length < 120) return first
  return null
}

function splitBlocks(text: string): string[] {
  const parts = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  if (parts.length > 0) return parts
  return text.trim() ? [text.trim()] : []
}

export function chunkDocumentText(
  rawText: string,
  intelligenceDocumentId: string,
): DocumentChunkDraft[] {
  const cleaned = cleanDocumentText(rawText)
  if (!cleaned) return []

  const blocks = splitBlocks(cleaned)
  const chunks: DocumentChunkDraft[] = []
  let buffer = ''
  let currentSection: string | null = null
  let chunkIndex = 0

  function flushBuffer() {
    const text = buffer.trim()
    if (!text) return

    const cleanChunkText = cleanDocumentText(text)
    if (!cleanChunkText) return

    chunks.push({
      chunkIndex,
      chunkText: text,
      cleanChunkText,
      chunkHash: hashChunkText(cleanChunkText, chunkIndex, intelligenceDocumentId),
      tokenEstimate: estimateTokens(cleanChunkText),
      pageNumber: null,
      sectionCode: null,
      sectionTitle: currentSection,
      chunkType: currentSection && text === currentSection ? 'heading' : 'text',
    })
    chunkIndex += 1

    if (cleanChunkText.length > CHUNK_OVERLAP) {
      buffer = cleanChunkText.slice(-CHUNK_OVERLAP)
    } else {
      buffer = ''
    }
  }

  for (const block of blocks) {
    const heading = detectSectionTitle(block)
    if (heading) currentSection = heading

    const candidate = buffer ? `${buffer}\n\n${block}` : block
    if (candidate.length <= TARGET_CHUNK_SIZE) {
      buffer = candidate
      continue
    }

    if (buffer) flushBuffer()

    if (block.length <= TARGET_CHUNK_SIZE) {
      buffer = block
      continue
    }

    let offset = 0
    while (offset < block.length) {
      const slice = block.slice(offset, offset + TARGET_CHUNK_SIZE)
      buffer = slice
      flushBuffer()
      offset += TARGET_CHUNK_SIZE - CHUNK_OVERLAP
      if (offset < 0) offset = 0
      if (slice.length < TARGET_CHUNK_SIZE) break
    }
  }

  flushBuffer()
  return chunks
}

export const MAX_CHUNKS_PER_DOC = 800
