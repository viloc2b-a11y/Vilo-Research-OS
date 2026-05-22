import type { ConfidenceLevel, EvidenceRef, ExtractedField } from '@/lib/protocol-intake/types'

export function evidenceRef(input: {
  file_name: string
  page_or_sheet: string
  section_reference?: string
  source_snippet: string
}): EvidenceRef {
  return {
    file_name: input.file_name,
    page_or_sheet: input.page_or_sheet,
    section_reference: input.section_reference,
    source_snippet: input.source_snippet.trim().slice(0, 500),
  }
}

export function extracted<T>(
  value: T,
  confidence: ConfidenceLevel,
  evidence: EvidenceRef[],
  options?: { requires_human_review?: boolean },
): ExtractedField<T> {
  const requires_human_review =
    options?.requires_human_review ?? confidence !== 'high'
  return {
    value,
    confidence,
    requires_human_review,
    reviewer_required: requires_human_review,
    evidence,
  }
}

export function mergeEvidence(...groups: EvidenceRef[][]): EvidenceRef[] {
  const seen = new Set<string>()
  const out: EvidenceRef[] = []
  for (const group of groups) {
    for (const ref of group) {
      const key = `${ref.file_name}|${ref.page_or_sheet}|${ref.source_snippet}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(ref)
    }
  }
  return out
}
