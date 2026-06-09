import type { ProtocolRuntimeSectionRow, ProtocolRuntimeVisitCandidateRow } from './protocol-intake-types'

export type ExtractedProcedureCandidate = {
  visit_candidate_id: string | null
  procedure_name: string
  procedure_category: string | null
  extracted_text: string | null
  confidence_score: number | null
  metadata: Record<string, unknown>
}

const PROCEDURE_BULLET_RE =
  /^\s*(?:-|\*|\u2022|\d+(?:\.\d+)*\.?|Procedure:|Note:|Footnote:|\[\d+\]|[a-z]\))\s*([A-Za-z][^\n]{2,160})/gim

const PROCEDURE_HINT_RE =
  /\b(vital signs?|pregnancy test|ecg|ekg|mri|sample collection|blood draw|questionnaire|adverse events?|concomitant medications?|swab|laboratory|lab assessments?|ophthalmology|adrenal testing|randomi[sz]ation|informed consent|ip administration|physical examination|assessment|follow[- ]?up|visit)\b/i

function inferProcedureCategory(text: string): string | null {
  const lowered = text.toLowerCase()
  if (/(vital|ecg|ekg|mri|physical examination|ophthalmology|adrenal)/i.test(lowered)) return 'clinical'
  if (/(sample|swab|laboratory|lab)/i.test(lowered)) return 'laboratory'
  if (/(questionnaire|survey|patient reported|epro)/i.test(lowered)) return 'questionnaire'
  if (/(adverse|safety|concomitant)/i.test(lowered)) return 'safety'
  if (/(informed consent|randomi[sz]ation|ip administration)/i.test(lowered)) return 'protocol'
  return null
}

function pushUnique(
  candidates: ExtractedProcedureCandidate[],
  seen: Set<string>,
  candidate: ExtractedProcedureCandidate,
) {
  const key = `${candidate.visit_candidate_id ?? ''}:${candidate.procedure_name.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)
  candidates.push(candidate)
}

export function extractProcedureCandidatesFromSections(args: {
  sections: ProtocolRuntimeSectionRow[]
  visits: ProtocolRuntimeVisitCandidateRow[]
}): ExtractedProcedureCandidate[] {
  const candidates: ExtractedProcedureCandidate[] = []
  const seen = new Set<string>()

  // Map visit mentions to visit candidates (very rough).
  const visitByName = new Map<string, ProtocolRuntimeVisitCandidateRow>()
  for (const v of args.visits) {
    visitByName.set(v.visitName.toLowerCase(), v)
    if (v.visitCode) visitByName.set(v.visitCode.toLowerCase(), v)
  }

  for (const section of args.sections) {
    if (!['procedure_section', 'schedule_of_activities', 'other', 'visit_schedule'].includes(section.sectionType)) continue

    const text = section.extractedText
    for (const match of text.matchAll(PROCEDURE_BULLET_RE)) {
      const name = String(match[1] ?? '').trim()
      if (!name) continue

      // Attempt to associate with a visit if the line includes "V1" / "Screening" etc.
      let visitCandidateId: string | null = null
      const loweredLine = match[0].toLowerCase()
      for (const [key, visit] of visitByName.entries()) {
        if (loweredLine.includes(key)) {
          visitCandidateId = visit.id
          break
        }
      }

      pushUnique(candidates, seen, {
        visit_candidate_id: visitCandidateId,
        procedure_name: name,
        procedure_category: inferProcedureCategory(name),
        extracted_text: match[0].trim(),
        confidence_score: 0.45,
        metadata: { source: 'procedure_bullet_regex', protocol_section_id: section.id },
      })
    }

    const lines = text.split(/\n+/)
    for (const line of lines) {
      if (!PROCEDURE_HINT_RE.test(line) || line.length < 6) continue
      let visitCandidateId: string | null = null
      const loweredLine = line.toLowerCase()
      for (const [key, visit] of visitByName.entries()) {
        if (loweredLine.includes(key)) {
          visitCandidateId = visit.id
          break
        }
      }
      pushUnique(candidates, seen, {
        visit_candidate_id: visitCandidateId,
        procedure_name: line.trim().slice(0, 160),
        procedure_category: inferProcedureCategory(line),
        extracted_text: line.trim(),
        confidence_score: 0.3,
        metadata: { source: 'procedure_hint_scan', protocol_section_id: section.id },
      })
    }
  }

  return candidates
}

