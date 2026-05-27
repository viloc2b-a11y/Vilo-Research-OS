import type { SupabaseClient } from '@supabase/supabase-js'
import { isDocumentIntelligenceDomain } from './document-domain-mapper'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'
import { INTELLIGENCE_STATUS } from './document-intelligence-types'
import { markEvidenceSupersededForDocumentFamily } from './mark-evidence-superseded-for-document-family'
import { mapActiveReferenceRow } from './document-version-types'
import type { DocumentIntelligenceActiveReferenceRow } from './document-version-types'

export type SetActiveDocumentReferenceInput = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  domains: DocumentIntelligenceDomain[]
  actorId: string
  reason?: string | null
}

export type SetActiveDocumentReferenceResult = {
  activeReferences: DocumentIntelligenceActiveReferenceRow[]
  evidenceSupersededCount: number
}

/**
 * Coordinator sets active reference version per domain.
 * Does not mutate runtime, published source, or blueprint content.
 */
export async function setActiveDocumentReference(
  supabase: SupabaseClient,
  input: SetActiveDocumentReferenceInput,
): Promise<SetActiveDocumentReferenceResult> {
  const domains = input.domains.filter((d) => isDocumentIntelligenceDomain(d))
  if (domains.length === 0) {
    throw new Error('At least one valid domain is required.')
  }

  const { data: doc, error: docError } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', input.intelligenceDocumentId)
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!doc) throw new Error('Intelligence document not found.')
  if (doc.intelligence_status !== INTELLIGENCE_STATUS.READY) {
    throw new Error('Only ready document versions can be set as active reference.')
  }

  const documentFamilyId = String(doc.document_family_id)
  const activeReferences: DocumentIntelligenceActiveReferenceRow[] = []
  let evidenceSupersededCount = 0

  for (const domain of domains) {
    const { data: domainRow } = await supabase
      .from('document_intelligence_domains')
      .select('id')
      .eq('intelligence_document_id', input.intelligenceDocumentId)
      .eq('domain', domain)
      .eq('status', 'active')
      .maybeSingle()

    if (!domainRow) {
      throw new Error(`Document is not tagged for domain "${domain}".`)
    }

    const { data: prior } = await supabase
      .from('document_intelligence_active_references')
      .select('*')
      .eq('document_family_id', documentFamilyId)
      .eq('study_id', input.studyId)
      .eq('active_reference_domain', domain)
      .eq('is_active_reference', true)
      .maybeSingle()

    const previousDocumentId = prior
      ? String((prior as Record<string, unknown>).intelligence_document_id)
      : null

    const { data: activated, error: activateError } = await supabase.rpc('set_active_reference', {
      filter_organization_id: input.organizationId,
      filter_study_id: input.studyId,
      filter_document_family_id: documentFamilyId,
      filter_domain: domain,
      new_intelligence_document_id: input.intelligenceDocumentId,
      actor_id: input.actorId,
      reason: input.reason ?? null,
    })

    if (activateError || !activated) {
      throw new Error(activateError?.message ?? 'Failed to set active reference')
    }

    const activatedRow = Array.isArray(activated) ? activated[0] : activated
    activeReferences.push(mapActiveReferenceRow(activatedRow as Record<string, unknown>))

    if (previousDocumentId && previousDocumentId !== input.intelligenceDocumentId) {
      evidenceSupersededCount += await markEvidenceSupersededForDocumentFamily({
        supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        documentFamilyId,
        activeIntelligenceDocumentId: input.intelligenceDocumentId,
        domain,
        actorId: input.actorId,
      })
    }
  }

  return { activeReferences, evidenceSupersededCount }
}
