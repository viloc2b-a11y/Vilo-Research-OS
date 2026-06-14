import type { SupabaseClient } from '@supabase/supabase-js'
import { mapConsentDocumentVersionRow, type ConsentDocumentVersionRow } from './consent-types'

export async function loadConsentDocumentVersions(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  statusFilter?: string[]
}): Promise<ConsentDocumentVersionRow[]> {
  const { supabase, organizationId, studyId, statusFilter } = args

  let query = supabase
    .from('consent_document_versions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('consent_type', { ascending: true })
    .order('version_number', { ascending: false })

  if (statusFilter && statusFilter.length > 0) {
    query = query.in('status', statusFilter)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapConsentDocumentVersionRow(r as Record<string, unknown>))
}
