import type { SupabaseClient } from '@supabase/supabase-js'
import { mapGenerationRunRow, type ProtocolRuntimeGenerationRunRow } from './protocol-runtime-generation-types'

export async function listGenerationRuns(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId?: string | null
  limit?: number
}): Promise<ProtocolRuntimeGenerationRunRow[]> {
  let query = args.supabase
    .from('protocol_runtime_generation_runs')
    .select('*')
    .eq('organization_id', args.organizationId)
    .order('created_at', { ascending: false })

  if (args.protocolVersionId) {
    query = query.eq('protocol_version_id', args.protocolVersionId)
  }
  if (args.limit) query = query.limit(args.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGenerationRunRow(row as Record<string, unknown>))
}

