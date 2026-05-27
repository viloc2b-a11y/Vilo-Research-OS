export const DOCUMENT_INTELLIGENCE_DOMAINS = [
  'source_creation',
  'budget_analysis',
  'contract_analysis',
  'regulatory_binder',
  'training',
  'delegation',
  'procedure_library',
  'general_library',
] as const

export type DocumentIntelligenceDomain = (typeof DOCUMENT_INTELLIGENCE_DOMAINS)[number]

export const DOMAIN_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const

const DOMAIN_SET = new Set<string>(DOCUMENT_INTELLIGENCE_DOMAINS)

export function normalizeDocumentClassification(classification: string): string {
  return classification
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function isDocumentIntelligenceDomain(value: string): value is DocumentIntelligenceDomain {
  return DOMAIN_SET.has(value)
}

export function resolveDefaultDomains(classification: string): DocumentIntelligenceDomain[] {
  const key = normalizeDocumentClassification(classification)

  const mapping: Record<string, DocumentIntelligenceDomain[]> = {
    protocol: [
      'source_creation',
      'budget_analysis',
      'regulatory_binder',
      'general_library',
    ],
    crf_guideline: ['source_creation', 'training', 'general_library'],
    lab_manual: ['source_creation', 'budget_analysis', 'general_library'],
    imaging_manual: ['source_creation', 'budget_analysis', 'general_library'],
    pharmacy_manual: ['source_creation', 'budget_analysis', 'general_library'],
    sop: ['training', 'regulatory_binder', 'general_library'],
    contract: ['contract_analysis', 'budget_analysis'],
    budget: ['budget_analysis'],
    training_material: ['training'],
    delegation: ['delegation', 'regulatory_binder'],
  }

  return mapping[key] ?? ['general_library']
}

function dedupeDomains(domains: DocumentIntelligenceDomain[]): DocumentIntelligenceDomain[] {
  const seen = new Set<DocumentIntelligenceDomain>()
  const result: DocumentIntelligenceDomain[] = []
  for (const domain of domains) {
    if (seen.has(domain)) continue
    seen.add(domain)
    result.push(domain)
  }
  return result
}

/**
 * Backend source of truth for applied domains at ingest.
 * - missing/empty explicit → defaults from classification only
 * - explicit provided → union of validated explicit + defaults, deduplicated
 */
export function resolveAppliedDomains(
  classification: string,
  explicitDomains?: string[] | null,
): DocumentIntelligenceDomain[] {
  const defaults = resolveDefaultDomains(classification)

  if (!explicitDomains?.length) {
    return dedupeDomains(defaults)
  }

  const validated = explicitDomains.filter(isDocumentIntelligenceDomain)
  return dedupeDomains([...validated, ...defaults])
}

export const DOCUMENT_INTELLIGENCE_DOMAIN_LABELS: Record<DocumentIntelligenceDomain, string> = {
  source_creation: 'Source Creation',
  budget_analysis: 'Budget Analysis',
  contract_analysis: 'Contract Analysis',
  regulatory_binder: 'Regulatory Binder',
  training: 'Training',
  delegation: 'Delegation',
  procedure_library: 'Procedure Library',
  general_library: 'General Library',
}
