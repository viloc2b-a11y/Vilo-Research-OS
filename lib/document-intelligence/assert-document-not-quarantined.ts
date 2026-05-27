import type { SupabaseClient } from '@supabase/supabase-js'
import { INTELLIGENCE_STATUS } from './document-intelligence-types'

export async function assertDocumentNotQuarantined(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  intelligenceDocumentId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('document_intelligence_documents')
    .select('intelligence_status')
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Intelligence document not found.')
  if (data.intelligence_status === INTELLIGENCE_STATUS.QUARANTINE) {
    throw new Error(
      'Document is quarantined for PHI review. Coordinator override is required before search or evidence extraction.',
    )
  }
}
