import { resolveAppliedDomains, type DocumentIntelligenceDomain } from './document-domain-mapper'
import {
  classifyDocumentIntelligence,
  CLASSIFICATION_AUTO_APPLY_THRESHOLD,
  type DocumentIntelligenceClassificationResult,
} from './classify-document-intelligence'

export type ResolvedIngestClassification = {
  appliedClassification: string
  appliedDomains: DocumentIntelligenceDomain[]
  classification: DocumentIntelligenceClassificationResult
  classificationMetadata: Record<string, unknown>
}

/**
 * Server-side source of truth: explicit coordinator domains always win.
 * Auto-classification >= 0.85 may override compliance metadata classification.
 */
export function resolveIngestClassification(args: {
  filename: string
  extractedText: string
  complianceClassification: string
  explicitDomains?: string[] | null
}): ResolvedIngestClassification {
  const classification = classifyDocumentIntelligence({
    filename: args.filename,
    textSample: args.extractedText,
    metadataClassification: args.complianceClassification,
  })

  const complianceNorm = args.complianceClassification.trim().toLowerCase()
  let appliedClassification = complianceNorm

  if (
    classification.tier === 'auto_apply' &&
    classification.confidence >= CLASSIFICATION_AUTO_APPLY_THRESHOLD
  ) {
    appliedClassification = classification.classification
  }

  const appliedDomains = resolveAppliedDomains(appliedClassification, args.explicitDomains)

  const classificationMetadata = {
    classifier: 'rule_v1',
    suggested_classification: classification.classification,
    applied_classification: appliedClassification,
    suggested_domains: classification.suggestedDomains,
    applied_domains: appliedDomains,
    confidence: classification.confidence,
    tier: classification.tier,
    matched_rules: classification.matchedRules,
    coordinator_domains_explicit: Boolean(args.explicitDomains?.length),
    classified_at: new Date().toISOString(),
  }

  return {
    appliedClassification,
    appliedDomains,
    classification,
    classificationMetadata,
  }
}
