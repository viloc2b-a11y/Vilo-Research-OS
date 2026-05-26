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
  /^\s*(?:-|\*|\u2022|\d+\.)\s*([A-Za-z][A-Za-z0-9 /()-]{2,80})\s*$/gim

export function extractProcedureCandidatesFromSections(args: {
  sections: ProtocolRuntimeSectionRow[]
  visits: ProtocolRuntimeVisitCandidateRow[]
}): ExtractedProcedureCandidate[] {
  const candidates: ExtractedProcedureCandidate[] = []

  // Map visit mentions to visit candidates (very rough).
  const visitByName = new Map<string, ProtocolRuntimeVisitCandidateRow>()
  for (const v of args.visits) {
    visitByName.set(v.visitName.toLowerCase(), v)
    if (v.visitCode) visitByName.set(v.visitCode.toLowerCase(), v)
  }

  for (const section of args.sections) {
    if (!['procedure_section', 'schedule_of_activities', 'other'].includes(section.sectionType)) continue

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

      candidates.push({
        visit_candidate_id: visitCandidateId,
        procedure_name: name,
        procedure_category: null,
        extracted_text: match[0].trim(),
        confidence_score: 0.45,
        metadata: { source: 'procedure_bullet_regex', protocol_section_id: section.id },
      })
    }
  }

  // Deduplicate by name + visit association.
  const seen = new Set<string>()
  return candidates.filter((c) => {
    const key = `${c.visit_candidate_id ?? ''}:${c.procedure_name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

