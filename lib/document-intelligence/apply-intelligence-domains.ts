import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DOMAIN_STATUS,
  isDocumentIntelligenceDomain,
  resolveAppliedDomains,
  type DocumentIntelligenceDomain,
} from './document-domain-mapper'

export type ApplyIntelligenceDomainsInput = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  complianceDocumentId: string
  documentClassification: string
  explicitDomains?: string[] | null
  createdBy: string | null
}

export async function archiveIntelligenceDocumentDomains(
  supabase: SupabaseClient,
  organizationId: string,
  intelligenceDocumentIds: string[],
): Promise<void> {
  if (intelligenceDocumentIds.length === 0) return

  const { error } = await supabase
    .from('document_intelligence_domains')
    .update({ status: DOMAIN_STATUS.ARCHIVED })
    .eq('organization_id', organizationId)
    .in('intelligence_document_id', intelligenceDocumentIds)
    .eq('status', DOMAIN_STATUS.ACTIVE)

  if (error) throw new Error(error.message)
}

export async function applyIntelligenceDocumentDomains(
  supabase: SupabaseClient,
  input: ApplyIntelligenceDomainsInput,
): Promise<DocumentIntelligenceDomain[]> {
  const appliedDomains = resolveAppliedDomains(
    input.documentClassification,
    input.explicitDomains,
  )

  if (appliedDomains.length === 0) return appliedDomains

  const rows = appliedDomains.map((domain) => ({
    organization_id: input.organizationId,
    study_id: input.studyId,
    intelligence_document_id: input.intelligenceDocumentId,
    compliance_document_id: input.complianceDocumentId,
    domain,
    status: DOMAIN_STATUS.ACTIVE,
    created_by: input.createdBy,
    metadata: {},
  }))

  const { error } = await supabase.from('document_intelligence_domains').upsert(rows, {
    onConflict: 'intelligence_document_id,domain',
    ignoreDuplicates: false,
  })

  if (error) {
    throw new Error(`Failed to apply intelligence domains: ${error.message}`)
  }

  return appliedDomains
}

export async function listActiveIntelligenceDocumentDomains(
  supabase: SupabaseClient,
  organizationId: string,
  intelligenceDocumentId: string,
): Promise<DocumentIntelligenceDomain[]> {
  const { data, error } = await supabase
    .from('document_intelligence_domains')
    .select('domain')
    .eq('organization_id', organizationId)
    .eq('intelligence_document_id', intelligenceDocumentId)
    .eq('status', DOMAIN_STATUS.ACTIVE)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => String(row.domain))
    .filter((domain): domain is DocumentIntelligenceDomain => isDocumentIntelligenceDomain(domain))
}

export async function archiveDomainsForSupersededIntelligenceDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  complianceDocumentId: string,
  excludeSourceHash: string,
): Promise<void> {
  const { data: supersededDocs, error: selectError } = await supabase
    .from('document_intelligence_documents')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('compliance_document_id', complianceDocumentId)
    .neq('source_hash', excludeSourceHash)
    .in('intelligence_status', ['ready', 'pending', 'superseded'])

  if (selectError) throw new Error(selectError.message)

  const ids = (supersededDocs ?? []).map((row) => String(row.id))
  await archiveIntelligenceDocumentDomains(supabase, organizationId, ids)
}
