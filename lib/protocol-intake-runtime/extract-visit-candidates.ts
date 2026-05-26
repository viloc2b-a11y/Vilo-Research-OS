import type { ProtocolRuntimeSectionRow } from './protocol-intake-types'

export type ExtractedVisitCandidate = {
  visit_code: string | null
  visit_name: string
  visit_type: string | null
  study_day: number | null
  window_before_days: number | null
  window_after_days: number | null
  extracted_from_section_id: string | null
  confidence_score: number | null
  metadata: Record<string, unknown>
}

const VISIT_LINE_RE =
  /^(V\d+|Week\s*\d+|Day\s*-?\d+|Screening|Baseline|Follow[- ]?up|EOS|ET)\s*[-:–]\s*([A-Za-z0-9][^\n]{2,80})/gim

export function extractVisitCandidatesFromSections(sections: ProtocolRuntimeSectionRow[]): ExtractedVisitCandidate[] {
  const candidates: ExtractedVisitCandidate[] = []

  for (const section of sections) {
    // Only attempt on schedule-like sections; otherwise skip.
    if (!['schedule_of_activities', 'visit_schedule', 'other'].includes(section.sectionType)) continue

    const text = section.extractedText
    for (const match of text.matchAll(VISIT_LINE_RE)) {
      const codeRaw = String(match[1] ?? '').trim()
      const name = String(match[2] ?? '').trim()
      if (!name) continue

      const visitCode = codeRaw.toUpperCase().startsWith('V') ? codeRaw.toUpperCase() : null
      candidates.push({
        visit_code: visitCode,
        visit_name: name,
        visit_type: null,
        study_day: null,
        window_before_days: null,
        window_after_days: null,
        extracted_from_section_id: section.id,
        confidence_score: 0.55,
        metadata: { source: 'visit_line_regex', raw_code: codeRaw },
      })
    }
  }

  // Deduplicate by (visit_code, visit_name)
  const seen = new Set<string>()
  return candidates.filter((c) => {
    const key = `${c.visit_code ?? ''}:${c.visit_name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

