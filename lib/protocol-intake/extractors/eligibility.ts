import { evidenceRef } from '@/lib/protocol-intake/evidence'
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import type { ExtractedEligibilityCriterion } from '@/lib/protocol-intake/types'

function parseBullets(sectionText: string, category: 'inclusion' | 'exclusion', fileName: string, page: string) {
  const lines = sectionText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^(\d+[\).\]]|[-•*])\s+/.test(l) || /^[A-Z].{10,}/.test(l))
  return lines.map((line) => ({
    criterion_text: line.replace(/^(\d+[\).\]]|[-•*])\s+/, '').trim(),
    category,
    source_page_or_section: page,
    confidence: 'medium' as const,
    requires_human_review: true,
    evidence: [
      evidenceRef({
        file_name: fileName,
        page_or_sheet: page,
        section_reference: category,
        source_snippet: line,
      }),
    ],
  }))
}

export function extractEligibility(corpus: NormalizedIntakeCorpus): {
  inclusion_criteria: ExtractedEligibilityCriterion[]
  exclusion_criteria: ExtractedEligibilityCriterion[]
} {
  const inclusion: ExtractedEligibilityCriterion[] = []
  const exclusion: ExtractedEligibilityCriterion[] = []

  for (const chunk of corpus.chunks) {
    const inc = chunk.text.match(
      /inclusion\s+criteria\s*:?\s*([\s\S]*?)(?=exclusion\s+criteria|$)/i,
    )
    if (inc?.[1]) {
      inclusion.push(
        ...parseBullets(inc[1], 'inclusion', chunk.file_name, chunk.page_or_sheet),
      )
    }
    const exc = chunk.text.match(
      /exclusion\s+criteria\s*:?\s*([\s\S]*?)(?=schedule\s+of\s+events|study\s+procedures|$)/i,
    )
    if (exc?.[1]) {
      exclusion.push(
        ...parseBullets(exc[1], 'exclusion', chunk.file_name, chunk.page_or_sheet),
      )
    }
  }

  return { inclusion_criteria: inclusion, exclusion_criteria: exclusion }
}
