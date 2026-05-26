import { SECTION_TYPE, type ProtocolSectionType } from './protocol-intake-types'

export type ExtractedSection = {
  section_code: string | null
  section_title: string
  section_type: ProtocolSectionType
  sequence_order: number
  extracted_text: string
  extraction_confidence: number | null
  requires_review: boolean
  metadata: Record<string, unknown>
}

// Note: avoid named capture groups (repo TS target may be < ES2018).
const HEADING_RE = /^((\d+(\.\d+)*)|appendix\s+[a-z0-9]+)?\s*([A-Z][^\n]{3,120})\s*$/gim

function classifySection(title: string): ProtocolSectionType {
  const t = title.toLowerCase()
  if (t.includes('schedule of activities') || t.includes('soa')) return SECTION_TYPE.SCHEDULE_OF_ACTIVITIES
  if (t.includes('visit schedule') || t.includes('schedule')) return SECTION_TYPE.VISIT_SCHEDULE
  if (t.includes('procedure') || t.includes('assessment')) return SECTION_TYPE.PROCEDURE_SECTION
  if (t.includes('eligibility') || t.includes('inclusion') || t.includes('exclusion')) return SECTION_TYPE.ELIGIBILITY
  if (t.includes('safety') || t.includes('adverse')) return SECTION_TYPE.SAFETY
  if (t.includes('lab')) return SECTION_TYPE.LABS
  if (t.includes('endpoint')) return SECTION_TYPE.ENDPOINTS
  if (t.includes('investigational product') || t.includes('ip ') || t.includes('drug')) {
    return SECTION_TYPE.IP_MANAGEMENT
  }
  if (t.includes('statistic') || t.includes('analysis')) return SECTION_TYPE.STATISTICS
  return SECTION_TYPE.OTHER
}

export function extractProtocolSectionsFromText(rawText: string): ExtractedSection[] {
  const text = rawText.replace(/\r\n/g, '\n')
  const headings: Array<{ idx: number; code: string | null; title: string }> = []

  for (const match of text.matchAll(HEADING_RE)) {
    const idx = match.index ?? 0
    const title = String(match[4] ?? '').trim()
    if (!title) continue
    headings.push({
      idx,
      code: match[1] ? String(match[1]).trim() : null,
      title,
    })
  }

  // If no headings detected, store the full document as one section.
  if (headings.length === 0) {
    return [
      {
        section_code: null,
        section_title: 'Protocol text (unstructured)',
        section_type: SECTION_TYPE.OTHER,
        sequence_order: 1,
        extracted_text: text.slice(0, 20000),
        extraction_confidence: 0.2,
        requires_review: true,
        metadata: { extraction: 'fallback_single_section' },
      },
    ]
  }

  const sections: ExtractedSection[] = []
  const ordered = headings.sort((a, b) => a.idx - b.idx)

  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i]
    const nextIdx = i + 1 < ordered.length ? ordered[i + 1].idx : text.length
    const extracted = text.slice(current.idx, nextIdx).trim()
    const sectionType = classifySection(current.title)
    sections.push({
      section_code: current.code,
      section_title: current.title,
      section_type: sectionType,
      sequence_order: i + 1,
      extracted_text: extracted.slice(0, 20000),
      extraction_confidence: 0.6,
      requires_review: sectionType === SECTION_TYPE.OTHER,
      metadata: { extraction: 'heading_split' },
    })
  }

  return sections
}

