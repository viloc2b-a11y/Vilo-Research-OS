import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'

export async function isActiveDocumentReferenceForDomain(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  intelligenceDocumentId: string,
  domain: DocumentIntelligenceDomain,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('document_intelligence_active_references')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('intelligence_document_id', intelligenceDocumentId)
    .eq('domain', domain)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function assertActiveDocumentReferenceForDomain(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  intelligenceDocumentId: string,
  domain: DocumentIntelligenceDomain,
): Promise<void> {
  const active = await isActiveDocumentReferenceForDomain(
    supabase,
    organizationId,
    studyId,
    intelligenceDocumentId,
    domain,
  )
  if (!active) {
    throw new Error(
      `This document version is not the active reference for domain "${domain}". Select the active reference version or ask a coordinator to activate it.`,
    )
  }
}
