/**
 * Phase 12C addendum — document normalization (pages, sections, tables, footnotes).
 */
import type { DocumentTextChunk, NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'

export type ContentKind = 'narrative' | 'table' | 'footnote' | 'heading'

export type TableCoordinates = {
  sheet_name?: string
  row_start?: number
  row_end?: number
  column_headers?: string[]
}

export type NormalizedSegment = {
  segment_id: string
  chunk_id: string
  file_name: string
  page_or_sheet: string
  section_reference?: string
  content_kind: ContentKind
  text: string
  table_coordinates?: TableCoordinates
}

export type EnrichedIntakeCorpus = NormalizedIntakeCorpus & {
  segments: NormalizedSegment[]
}

const FOOTNOTE_LINE = /^(?:footnote|\[\d+\]|\d+\))\s*:?\s*/i
const HEADING_LINE = /^(?:section\s+\d+|[A-Z][A-Z0-9\s\-]{4,}):?\s*$/i

function splitFootnotes(text: string): { body: string; footnotes: string[] } {
  const footnotes: string[] = []
  const bodyLines: string[] = []
  for (const line of text.split('\n')) {
    if (FOOTNOTE_LINE.test(line.trim())) {
      footnotes.push(line.trim())
    } else {
      bodyLines.push(line)
    }
  }
  return { body: bodyLines.join('\n'), footnotes }
}

function detectTableCoords(text: string, pageOrSheet: string): TableCoordinates | undefined {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return undefined
  const header = lines[0]
  if (!header.includes('\t') && !header.includes(',')) return undefined
  const delimiter = header.includes('\t') ? '\t' : ','
  return {
    sheet_name: pageOrSheet,
    row_start: 1,
    row_end: lines.length,
    column_headers: header.split(delimiter).map((c) => c.trim()),
  }
}

function segmentChunk(chunk: DocumentTextChunk): NormalizedSegment[] {
  const { body, footnotes } = splitFootnotes(chunk.text)
  const segments: NormalizedSegment[] = []
  let idx = 0

  const tableCoords = detectTableCoords(body, chunk.page_or_sheet)
  const isTable =
    chunk.section_reference?.toLowerCase().includes('schedule')
    || Boolean(tableCoords)
    || body.includes('\t')

  if (isTable && tableCoords) {
    segments.push({
      segment_id: `${chunk.chunk_id}-table`,
      chunk_id: chunk.chunk_id,
      file_name: chunk.file_name,
      page_or_sheet: chunk.page_or_sheet,
      section_reference: chunk.section_reference ?? 'Schedule of Events',
      content_kind: 'table',
      text: body,
      table_coordinates: tableCoords,
    })
    idx++
  }

  for (const block of body.split(/\n{2,}/)) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const kind: ContentKind = HEADING_LINE.test(trimmed) ? 'heading' : 'narrative'
    segments.push({
      segment_id: `${chunk.chunk_id}-n${idx++}`,
      chunk_id: chunk.chunk_id,
      file_name: chunk.file_name,
      page_or_sheet: chunk.page_or_sheet,
      section_reference: chunk.section_reference,
      content_kind: kind,
      text: trimmed,
    })
  }

  for (const fn of footnotes) {
    segments.push({
      segment_id: `${chunk.chunk_id}-fn${idx++}`,
      chunk_id: chunk.chunk_id,
      file_name: chunk.file_name,
      page_or_sheet: chunk.page_or_sheet,
      section_reference: 'Footnote',
      content_kind: 'footnote',
      text: fn,
    })
  }

  if (!segments.length) {
    segments.push({
      segment_id: chunk.chunk_id,
      chunk_id: chunk.chunk_id,
      file_name: chunk.file_name,
      page_or_sheet: chunk.page_or_sheet,
      section_reference: chunk.section_reference,
      content_kind: 'narrative',
      text: chunk.text,
    })
  }

  return segments
}

export function enrichIntakeCorpus(corpus: NormalizedIntakeCorpus): EnrichedIntakeCorpus {
  const segments = corpus.chunks.flatMap(segmentChunk)
  return { ...corpus, segments }
}
