import { createServerClient } from '@/lib/supabase/server'
import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'

export async function loadStudyOperationalDocuments(studyId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('compliance_runtime_documents')
    .select('*')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('destination_domain', 'study_documents')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading study operational documents', error)
    return []
  }

  return (data as ComplianceRuntimeDocument[]) || []
}
