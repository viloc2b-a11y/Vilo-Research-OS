/**
 * Phase 12C addendum — conflict detection (never silent merge).
 */
import type { EnrichedIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import { evidenceRef } from '@/lib/protocol-intake/evidence'
import type { IntakeConflict, ProtocolIntakeDraft } from '@/lib/protocol-intake/types'

const PROTOCOL_PATTERN = /protocol\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]+)/gi
const PHASE_PATTERN = /phase\s*([12][ab]?|3|4)/gi

export function detectIntakeConflicts(
  draft: ProtocolIntakeDraft,
  corpus: EnrichedIntakeCorpus,
): IntakeConflict[] {
  const conflicts: IntakeConflict[] = []

  const protocolHits = new Map<string, ReturnType<typeof evidenceRef>[]>()
  let m: RegExpExecArray | null
  const protoRe = new RegExp(PROTOCOL_PATTERN.source, PROTOCOL_PATTERN.flags)
  while ((m = protoRe.exec(corpus.full_text)) !== null) {
    const val = (m[1] ?? '').trim().toUpperCase()
    if (!val) continue
    const chunk = corpus.chunks.find((c) => c.text.includes(m![0])) ?? corpus.chunks[0]
    const ref = evidenceRef({
      file_name: chunk?.file_name ?? 'unknown',
      page_or_sheet: chunk?.page_or_sheet ?? 'corpus',
      source_snippet: m[0].trim(),
    })
    const list = protocolHits.get(val) ?? []
    list.push(ref)
    protocolHits.set(val, list)
  }

  const distinctProtocols = [...protocolHits.keys()]
  if (distinctProtocols.length > 1) {
    conflicts.push({
      conflict_id: 'protocol_number_disagreement',
      field: 'protocol_number',
      values: distinctProtocols,
      message: `Multiple protocol numbers found: ${distinctProtocols.join(' vs ')}`,
      evidence: [...protocolHits.values()].flat(),
      requires_human_review: true,
    })
  }

  const phaseHits = new Set<string>()
  const phaseEvidence: ReturnType<typeof evidenceRef>[] = []
  const phaseRe = new RegExp(PHASE_PATTERN.source, PHASE_PATTERN.flags)
  while ((m = phaseRe.exec(corpus.full_text)) !== null) {
    phaseHits.add((m[1] ?? '').trim().toLowerCase())
    const chunk = corpus.chunks.find((c) => c.text.includes(m![0])) ?? corpus.chunks[0]
    phaseEvidence.push(
      evidenceRef({
        file_name: chunk?.file_name ?? 'unknown',
        page_or_sheet: chunk?.page_or_sheet ?? 'corpus',
        source_snippet: m[0].trim(),
      }),
    )
  }
  if (phaseHits.size > 1) {
    conflicts.push({
      conflict_id: 'phase_disagreement',
      field: 'phase',
      values: [...phaseHits],
      message: `Conflicting phase values: ${[...phaseHits].join(' vs ')}`,
      evidence: phaseEvidence,
      requires_human_review: true,
    })
  }

  const narrativeVisits = new Map<string, number>()
  for (const visit of draft.schedule.visits) {
    if (visit.study_day.value != null) {
      narrativeVisits.set(visit.visit_code.value, visit.study_day.value)
    }
  }

  for (const segment of corpus.segments.filter((s) => s.content_kind === 'table')) {
    for (const line of segment.text.split('\n')) {
      const row = line.match(/^V(\d+),([^,]+),(\d+)/i)
      if (!row) continue
      const code = row[2].trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 32)
      const tableDay = Number(row[3])
      const draftVisit = draft.schedule.visits.find((v) => v.visit_code.value === code)
      if (
        draftVisit
        && draftVisit.study_day.value != null
        && draftVisit.study_day.value !== tableDay
      ) {
        conflicts.push({
          conflict_id: `visit_day_${code}`,
          field: 'study_day',
          values: [String(draftVisit.study_day.value), String(tableDay)],
          message: `Visit ${draftVisit.visit_name.value}: narrative day ${draftVisit.study_day.value} vs table day ${tableDay}`,
          evidence: [
            ...draftVisit.evidence,
            evidenceRef({
              file_name: segment.file_name,
              page_or_sheet: segment.page_or_sheet,
              section_reference: 'Schedule table',
              source_snippet: line.trim(),
            }),
          ],
          requires_human_review: true,
        })
      }
    }
  }

  const extractedPn = draft.study_metadata.protocol_number.value?.toUpperCase()
  if (
    extractedPn
    && distinctProtocols.length === 1
    && distinctProtocols[0] !== extractedPn.replace(/-/g, '_').replace(/_/g, '-')
    && distinctProtocols[0] !== extractedPn
  ) {
    conflicts.push({
      conflict_id: 'protocol_extract_vs_corpus',
      field: 'protocol_number',
      values: [extractedPn, distinctProtocols[0]!],
      message: 'Extracted protocol number differs from secondary corpus mention',
      evidence: draft.study_metadata.protocol_number.evidence,
      requires_human_review: true,
    })
  }

  return conflicts
}
