/**
 * Phase 12C addendum — hybrid retrieval (keyword + lightweight semantic + section/table aware).
 * No external embeddings API — deterministic TF overlap for semantic channel.
 */
import type { NormalizedSegment, EnrichedIntakeCorpus, ContentKind } from '@/lib/protocol-intake/normalization/enrich-corpus'
import { evidenceRef } from '@/lib/protocol-intake/evidence'
import type { EvidenceRef } from '@/lib/protocol-intake/types'

export type RetrievalChannel = 'keyword' | 'semantic' | 'table' | 'section'

export type RetrievalHit = {
  segment: NormalizedSegment
  score: number
  channel: RetrievalChannel
}

export type RetrievalQuery = {
  query: string
  section_hint?: string
  prefer_tables?: boolean
  content_kinds?: ContentKind[]
  limit?: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function keywordScore(queryTokens: string[], segmentText: string): number {
  const segTokens = new Set(tokenize(segmentText))
  if (!queryTokens.length) return 0
  let hits = 0
  for (const t of queryTokens) {
    if (segTokens.has(t)) hits++
  }
  return hits / queryTokens.length
}

function semanticScore(queryTokens: string[], segmentText: string): number {
  const segTokens = tokenize(segmentText)
  const segSet = new Set(segTokens)
  const qSet = new Set(queryTokens)
  const intersection = queryTokens.filter((t) => segSet.has(t)).length
  const union = new Set([...queryTokens, ...segTokens]).size
  return union === 0 ? 0 : intersection / union
}

export function retrieveSegments(
  corpus: EnrichedIntakeCorpus,
  query: RetrievalQuery,
): RetrievalHit[] {
  const queryTokens = tokenize(query.query)
  const limit = query.limit ?? 5
  const hits: RetrievalHit[] = []

  for (const segment of corpus.segments) {
    if (query.content_kinds?.length && !query.content_kinds.includes(segment.content_kind)) {
      continue
    }
    if (query.prefer_tables && segment.content_kind !== 'table') {
      continue
    }
    if (
      query.section_hint
      && segment.section_reference
      && !segment.section_reference.toLowerCase().includes(query.section_hint.toLowerCase())
    ) {
      continue
    }

    const kw = keywordScore(queryTokens, segment.text)
    const sem = semanticScore(queryTokens, segment.text)
    const tableBoost = segment.content_kind === 'table' && query.prefer_tables ? 0.25 : 0
    const sectionBoost =
      query.section_hint
      && segment.section_reference?.toLowerCase().includes(query.section_hint.toLowerCase())
        ? 0.15
        : 0

    const score = Math.min(1, kw * 0.55 + sem * 0.35 + tableBoost + sectionBoost)
    if (score <= 0.08) continue

    hits.push({
      segment,
      score,
      channel: segment.content_kind === 'table' ? 'table' : kw >= sem ? 'keyword' : 'semantic',
    })
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function hitsToEvidence(hits: RetrievalHit[]): EvidenceRef[] {
  return hits.map((hit) =>
    evidenceRef({
      file_name: hit.segment.file_name,
      page_or_sheet: hit.segment.page_or_sheet,
      section_reference:
        hit.segment.table_coordinates
          ? `Table ${hit.segment.table_coordinates.sheet_name ?? hit.segment.page_or_sheet}`
          : hit.segment.section_reference,
      source_snippet: hit.segment.text.slice(0, 500),
    }),
  )
}

export function retrieveEvidence(
  corpus: EnrichedIntakeCorpus,
  query: RetrievalQuery,
): EvidenceRef[] {
  return hitsToEvidence(retrieveSegments(corpus, query))
}
