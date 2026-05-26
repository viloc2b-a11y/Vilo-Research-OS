import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadComplianceDocumentForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
): Promise<{ id: string; cryptographic_hash: string } | null> {
  const { data, error } = await supabase
    .from('compliance_runtime_documents')
    .select('id, cryptographic_hash')
    .eq('id', documentId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: String(data.id),
    cryptographic_hash: String(data.cryptographic_hash),
  }
}
