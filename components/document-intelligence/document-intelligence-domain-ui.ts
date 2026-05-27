import {
  DOCUMENT_INTELLIGENCE_DOMAIN_LABELS,
  DOCUMENT_INTELLIGENCE_DOMAINS,
  type DocumentIntelligenceDomain,
} from '@/lib/document-intelligence/document-domain-mapper'

export const SEARCH_AREA_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All study documents' },
  ...DOCUMENT_INTELLIGENCE_DOMAINS.map((domain) => ({
    value: domain,
    label: DOCUMENT_INTELLIGENCE_DOMAIN_LABELS[domain],
  })),
]

export function domainLabel(domain: DocumentIntelligenceDomain): string {
  return DOCUMENT_INTELLIGENCE_DOMAIN_LABELS[domain]
}
