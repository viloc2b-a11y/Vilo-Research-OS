import type { SupabaseClient } from '@supabase/supabase-js'
import { mapProtocolRuntimeStudyRow, type ProtocolRuntimeStudyRow } from './protocol-intake-types'

export async function listProtocolRuntimeStudies(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ProtocolRuntimeStudyRow[]> {
  const { data, error } = await supabase
    .from('protocol_runtime_studies')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProtocolRuntimeStudyRow(row as Record<string, unknown>))
}

