import {
  normalizeDocumentClassification,
  resolveDefaultDomains,
  type DocumentIntelligenceDomain,
} from './document-domain-mapper'

export const CLASSIFICATION_AUTO_APPLY_THRESHOLD = 0.85
export const CLASSIFICATION_SUGGEST_THRESHOLD = 0.6

export type ClassificationTier = 'auto_apply' | 'suggest' | 'manual_review'

export type DocumentIntelligenceClassificationResult = {
  classification: string
  suggestedDomains: DocumentIntelligenceDomain[]
  confidence: number
  tier: ClassificationTier
  matchedRules: string[]
}

type Rule = {
  id: string
  classification: string
  filenamePatterns: RegExp[]
  textPatterns: RegExp[]
  baseConfidence: number
}

const RULES: Rule[] = [
  {
    id: 'protocol',
    classification: 'protocol',
    filenamePatterns: [/protocol/i, /\bcsp\b/i, /\baccr\b/i],
    textPatterns: [/protocol synopsis/i, /schedule of assessments/i, /investigator/i],
    baseConfidence: 0.88,
  },
  {
    id: 'crf',
    classification: 'crf_guideline',
    filenamePatterns: [/crf/i, /case report/i, /source document/i],
    textPatterns: [/case report form/i, /data capture/i, /electronic data capture/i],
    baseConfidence: 0.86,
  },
  {
    id: 'sop',
    classification: 'sop',
    filenamePatterns: [/\bsop\b/i, /standard operating/i],
    textPatterns: [/standard operating procedure/i, /work instruction/i],
    baseConfidence: 0.87,
  },
  {
    id: 'lab',
    classification: 'lab_manual',
    filenamePatterns: [/lab/i, /laboratory/i, /specimen/i],
    textPatterns: [/specimen collection/i, /centrifuge/i, /laboratory manual/i],
    baseConfidence: 0.84,
  },
  {
    id: 'consent',
    classification: 'icf_consent',
    filenamePatterns: [/icf/i, /consent/i, /informed consent/i],
    textPatterns: [/informed consent/i, /subject consent/i, /re-consent/i],
    baseConfidence: 0.83,
  },
  {
    id: 'budget',
    classification: 'budget',
    filenamePatterns: [/budget/i, /cost/i, /invoice/i],
    textPatterns: [/budget worksheet/i, /pass-through/i, /reimbursement/i],
    baseConfidence: 0.83,
  },
  {
    id: 'contract',
    classification: 'contract',
    filenamePatterns: [/contract/i, /cta/i, /agreement/i],
    textPatterns: [/clinical trial agreement/i, /budget schedule/i, /payment terms/i],
    baseConfidence: 0.82,
  },
  {
    id: 'training',
    classification: 'training_material',
    filenamePatterns: [/training/i, /slides/i, /module/i],
    textPatterns: [/training material/i, /competency/i, /learning objective/i],
    baseConfidence: 0.81,
  },
  {
    id: 'delegation',
    classification: 'delegation',
    filenamePatterns: [/delegation/i, /dolr/i, /log of responsibility/i],
    textPatterns: [/delegation of authority/i, /study team roster/i],
    baseConfidence: 0.8,
  },
]

function scoreRule(
  rule: Rule,
  filename: string,
  textSample: string,
): { score: number; matched: string[] } {
  let score = rule.baseConfidence
  const matched: string[] = []

  if (rule.filenamePatterns.some((p) => p.test(filename))) {
    score += 0.08
    matched.push(`${rule.id}:filename`)
  }
  const textHits = rule.textPatterns.filter((p) => p.test(textSample)).length
  if (textHits > 0) {
    score += Math.min(0.1, textHits * 0.04)
    matched.push(`${rule.id}:text`)
  }

  return { score: Math.min(0.99, score), matched }
}

export function classifyDocumentIntelligence(input: {
  filename: string
  textSample: string
  metadataClassification?: string | null
}): DocumentIntelligenceClassificationResult {
  const filename = input.filename.trim()
  const textSample = input.textSample.slice(0, 2000)
  const fallbackClassification = normalizeDocumentClassification(
    input.metadataClassification?.trim() || 'general',
  )

  let best: DocumentIntelligenceClassificationResult | null = null

  for (const rule of RULES) {
    const { score, matched } = scoreRule(rule, filename, textSample)
    if (!best || score > best.confidence) {
      const classification = normalizeDocumentClassification(rule.classification)
      best = {
        classification,
        suggestedDomains: resolveDefaultDomains(classification),
        confidence: score,
        tier:
          score >= CLASSIFICATION_AUTO_APPLY_THRESHOLD
            ? 'auto_apply'
            : score >= CLASSIFICATION_SUGGEST_THRESHOLD
              ? 'suggest'
              : 'manual_review',
        matchedRules: matched,
      }
    }
  }

  if (!best || best.confidence < CLASSIFICATION_SUGGEST_THRESHOLD) {
    return {
      classification: fallbackClassification,
      suggestedDomains: resolveDefaultDomains(fallbackClassification),
      confidence: best?.confidence ?? 0.4,
      tier: 'manual_review',
      matchedRules: best?.matchedRules ?? ['fallback:metadata'],
    }
  }

  return best
}

export function buildClassificationMetadata(
  result: DocumentIntelligenceClassificationResult,
  appliedClassification: string,
): Record<string, unknown> {
  return {
    classifier: 'rule_v1',
    suggested_classification: result.classification,
    applied_classification: appliedClassification,
    suggested_domains: result.suggestedDomains,
    confidence: result.confidence,
    tier: result.tier,
    matched_rules: result.matchedRules,
    classified_at: new Date().toISOString(),
  }
}
