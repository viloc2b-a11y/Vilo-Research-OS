/**
 * Phase 12C addendum — evidence match + confidence gates before high confidence.
 */
import type { ConfidenceLevel, EvidenceRef } from '@/lib/protocol-intake/types'
import type { EnrichedIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import { retrieveSegments } from '@/lib/protocol-intake/rag/retrieval'

export type EvidenceGateResult = {
  confidence: ConfidenceLevel
  reviewer_required: boolean
  evidence: EvidenceRef[]
  gate_notes: string[]
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function evidenceSupportsValue(value: string, evidence: EvidenceRef[]): boolean {
  const needle = normalizeValue(value)
  if (!needle) return false
  return evidence.some((ref) => normalizeValue(ref.source_snippet).includes(needle))
}

export function applyEvidenceGates(input: {
  field_label: string
  extracted_value: string | null
  evidence: EvidenceRef[]
  corpus: EnrichedIntakeCorpus
  narrative_alternate?: string | null
  table_alternate?: string | null
  footnote_dependency?: boolean
}): EvidenceGateResult {
  const notes: string[] = []
  const value = input.extracted_value?.trim() ?? ''

  if (!value) {
    return {
      confidence: 'low',
      reviewer_required: true,
      evidence: input.evidence,
      gate_notes: ['No value extracted'],
    }
  }

  if (!input.evidence.length) {
    const retrieved = retrieveSegments(input.corpus, {
      query: `${input.field_label} ${value}`,
      limit: 3,
    })
    if (retrieved.length) {
      input.evidence.push(
        ...retrieved.map((h) => ({
          file_name: h.segment.file_name,
          page_or_sheet: h.segment.page_or_sheet,
          section_reference: h.segment.section_reference,
          source_snippet: h.segment.text.slice(0, 500),
        })),
      )
      notes.push('Evidence retrieved post-extraction')
    } else {
      return {
        confidence: 'low',
        reviewer_required: true,
        evidence: [],
        gate_notes: ['No supporting evidence found'],
      }
    }
  }

  const directMatch = evidenceSupportsValue(value, input.evidence)
  if (!directMatch) {
    notes.push('Extracted value not found verbatim in evidence snippet')
  }

  if (input.narrative_alternate && input.table_alternate) {
    const n = normalizeValue(input.narrative_alternate)
    const t = normalizeValue(input.table_alternate)
    if (n && t && n !== t) {
      notes.push('Narrative and table sources disagree')
    }
  }

  if (input.footnote_dependency) {
    notes.push('Unresolved footnote dependency — reviewer required')
  }

  let confidence: ConfidenceLevel = 'high'
  if (!directMatch) confidence = 'medium'
  if (notes.some((n) => n.includes('disagree') || n.includes('footnote'))) confidence = 'low'

  const reviewer_required =
    confidence !== 'high' || notes.length > 0

  return {
    confidence,
    reviewer_required,
    evidence: input.evidence,
    gate_notes: notes,
  }
}
