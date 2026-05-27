import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'
/**
 * When a new version becomes ready, set active reference for domains that have none yet.
 */
export async function ensureDefaultActiveReferencesForDomains(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    studyId: string
    intelligenceDocumentId: string
    documentFamilyId: string
    domains: DocumentIntelligenceDomain[]
    actorId: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()

  for (const domain of args.domains) {
    const { data: existing } = await supabase
      .from('document_intelligence_active_references')
      .select('id')
      .eq('document_family_id', args.documentFamilyId)
      .eq('study_id', args.studyId)
      .eq('domain', domain)
      .eq('is_active_reference', true)
      .maybeSingle()

    if (existing) continue

    await supabase.from('document_intelligence_active_references').insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      document_family_id: args.documentFamilyId,
      domain,
      intelligence_document_id: args.intelligenceDocumentId,
      is_active_reference: true,
      active_reference_set_by: args.actorId,
      active_reference_set_at: now,
      active_reference_reason: 'default_first_ready_version',
    })

    await supabase.from('document_intelligence_active_reference_events').insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      document_family_id: args.documentFamilyId,
      domain,
      previous_intelligence_document_id: null,
      new_intelligence_document_id: args.intelligenceDocumentId,
      actor_id: args.actorId,
      reason: 'default_first_ready_version',
      event_payload: { auto: true },
    })
  }

}
