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
  /^(Visit\s*\d+|V\d+|Week\s*\d+|Day\s*-?\d+|Screening|Baseline|Follow[- ]?up|EOS|ET)\s*[-:–]\s*([A-Za-z0-9][^\n]{2,80})/gim
const VISIT_TOKEN_RE = /\b(Visit\s*\d+|V\d+|Week\s*\d+|Day\s*-?\d+|Screening|Baseline|Follow[- ]?up|EOS|ET)\b/gi

function normalizeVisitCode(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^(V\d+|Visit\s*\d+|Week\s*\d+|Day\s*-?\d+)$/i.test(trimmed)) return trimmed.replace(/\s+/g, ' ').toUpperCase()
  if (/^(Screening|Baseline|Follow[- ]?up|EOS|ET)$/i.test(trimmed)) return null
  return null
}

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

    const lines = text.split(/\n+/)
    for (const line of lines) {
      const lowered = line.toLowerCase()
      if (
        !/(visit|screening|baseline|follow|eos|et|day\s*-?\d+|week\s*\d+)/i.test(line) &&
        !/[|:\u2013-]/.test(line)
      ) {
        continue
      }

      const tokens = new Set<string>()
      for (const match of line.matchAll(VISIT_TOKEN_RE)) {
        const token = String(match[1] ?? '').trim()
        if (token) tokens.add(token)
      }

      if (tokens.size === 0) continue

      for (const token of tokens) {
        const visitCode = normalizeVisitCode(token)
        const visitName = token.replace(/\s+/g, ' ').trim()
        if (!visitName) continue
        candidates.push({
          visit_code: visitCode,
          visit_name: visitName,
          visit_type: lowered.includes('follow') ? 'follow-up' : lowered.includes('screen') ? 'screening' : null,
          study_day: null,
          window_before_days: null,
          window_after_days: null,
          extracted_from_section_id: section.id,
          confidence_score: 0.35,
          metadata: { source: 'visit_token_scan', raw_line: line.slice(0, 240) },
        })
      }
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

