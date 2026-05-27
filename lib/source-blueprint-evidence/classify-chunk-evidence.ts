import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { EVIDENCE_KIND, type EvidenceKind } from './source-blueprint-evidence-types'

export type ClassifiedEvidenceDraft = {
  evidenceKind: EvidenceKind
  title: string
  summary: string
  structuredPayload: Record<string, unknown>
  confidenceScore: number
}

const KIND_PATTERNS: { kind: EvidenceKind; patterns: RegExp[]; title: string }[] = [
  {
    kind: EVIDENCE_KIND.VISIT_WINDOW,
    patterns: [
      /\bvisit\b/i,
      /\bwindow\b/i,
      /\bday\s*[+-]?\s*\d+/i,
      /\bscreening\b/i,
      /\bbaseline\b/i,
      /\bfollow[- ]?up\b/i,
    ],
    title: 'Visit window reference',
  },
  {
    kind: EVIDENCE_KIND.TIMING_RULE,
    patterns: [
      /\btiming\b/i,
      /\bschedule\b/i,
      /\binterval\b/i,
      /\bwithin\s+\d+\s+(day|week|hour)/i,
      /\b±\s*\d+/i,
    ],
    title: 'Timing rule reference',
  },
  {
    kind: EVIDENCE_KIND.PROCEDURE_GENERATION,
    patterns: [
      /\bprocedure\b/i,
      /\bassessment\b/i,
      /\bphysical exam\b/i,
      /\bvital signs?\b/i,
      /\becg\b/i,
      /\bquestionnaire\b/i,
    ],
    title: 'Procedure generation reference',
  },
  {
    kind: EVIDENCE_KIND.LAB_HANDLING,
    patterns: [
      /\blab(oratory)?\b/i,
      /\bspecimen\b/i,
      /\bcollection\b/i,
      /\bcentrifuge\b/i,
      /\bshipping\b/i,
      /\bfasting\b/i,
    ],
    title: 'Lab handling reference',
  },
  {
    kind: EVIDENCE_KIND.SAFETY_WORKFLOW,
    patterns: [
      /\bsafety\b/i,
      /\badverse event\b/i,
      /\bsae\b/i,
      /\bcontraindication\b/i,
      /\bstop\b/i,
      /\bhold\b/i,
      /\bdiscontinue\b/i,
    ],
    title: 'Safety workflow reference',
  },
  {
    kind: EVIDENCE_KIND.BILLING_HINT,
    patterns: [
      /\bbilling\b/i,
      /\bcost\b/i,
      /\binvoice\b/i,
      /\bbudget\b/i,
      /\bCPT\b/i,
      /\breimbursement\b/i,
    ],
    title: 'Billing hint reference',
  },
  {
    kind: EVIDENCE_KIND.SOURCE_DRAFTING,
    patterns: [
      /\bsource\b/i,
      /\bcrf\b/i,
      /\bform\b/i,
      /\bfield\b/i,
      /\bdata capture\b/i,
      /\belectronic\b/i,
    ],
    title: 'Source drafting reference',
  },
]

function scorePatternMatches(text: string, patterns: RegExp[]): number {
  let score = 0
  for (const pattern of patterns) {
    if (pattern.test(text)) score += 1
  }
  return score
}

function extractVisitWindowHints(text: string): Record<string, unknown> {
  const windowMatch = text.match(/(?:window|±)\s*([+-]?\d+)\s*\/\s*([+-]?\d+)/i)
  const dayMatch = text.match(/day\s*([+-]?\d+)/i)
  return {
    window_before_days: windowMatch ? Number(windowMatch[1]) : null,
    window_after_days: windowMatch ? Number(windowMatch[2]) : null,
    study_day: dayMatch ? Number(dayMatch[1]) : null,
  }
}

function extractProcedureHints(text: string): Record<string, unknown> {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 3 && line.length < 120)
  return { candidate_lines: lines.slice(0, 8) }
}

export function classifyChunkEvidenceKinds(
  cleanText: string,
  usageDomain: DocumentIntelligenceDomain,
): ClassifiedEvidenceDraft[] {
  const text = cleanText.trim()
  if (!text) return []

  const results: ClassifiedEvidenceDraft[] = []

  for (const entry of KIND_PATTERNS) {
    const score = scorePatternMatches(text, entry.patterns)
    if (score === 0) continue

    const confidence = Math.min(0.95, 0.45 + score * 0.15)
    let structuredPayload: Record<string, unknown> = { usage_domain: usageDomain, match_score: score }

    if (entry.kind === EVIDENCE_KIND.VISIT_WINDOW) {
      structuredPayload = { ...structuredPayload, ...extractVisitWindowHints(text) }
    } else if (entry.kind === EVIDENCE_KIND.PROCEDURE_GENERATION) {
      structuredPayload = { ...structuredPayload, ...extractProcedureHints(text) }
    }

    const excerpt = text.replace(/\s+/g, ' ').slice(0, 280)
    results.push({
      evidenceKind: entry.kind,
      title: entry.title,
      summary: excerpt.length > 120 ? `${excerpt.slice(0, 117)}…` : excerpt,
      structuredPayload,
      confidenceScore: confidence,
    })
  }

  if (results.length === 0 && usageDomain === 'source_creation') {
    results.push({
      evidenceKind: EVIDENCE_KIND.SOURCE_DRAFTING,
      title: 'General source reference',
      summary: text.replace(/\s+/g, ' ').slice(0, 200),
      structuredPayload: { usage_domain: usageDomain, general: true },
      confidenceScore: 0.35,
    })
  }

  return results
}
