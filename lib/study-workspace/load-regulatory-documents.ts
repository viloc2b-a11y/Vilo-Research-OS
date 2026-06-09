import { createServerClient } from '@/lib/supabase/server'
import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'

const DEFAULT_REGULATORY_DOCUMENT_LIST_LIMIT = 75

export async function loadStudyRegulatoryDocuments(
  studyId: string,
  organizationId: string,
  searchQuery?: string | null,
) {
  const supabase = await createServerClient()
  const normalizedSearch = searchQuery?.trim() ?? ''

  let query = supabase
    .from('compliance_runtime_documents')
    .select('*')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('destination_domain', 'regulatory_binder')
    .order('created_at', { ascending: false })
    .limit(DEFAULT_REGULATORY_DOCUMENT_LIST_LIMIT)

  if (normalizedSearch) {
    query = query.or(
      `operational_display_name.ilike.%${normalizedSearch}%,original_filename.ilike.%${normalizedSearch}%,document_classification.ilike.%${normalizedSearch}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error loading regulatory documents', error)
    return []
  }

  return (data as ComplianceRuntimeDocument[]) || []
}
