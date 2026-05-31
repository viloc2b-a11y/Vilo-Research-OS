import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapOperationalSignatureRequestRow,
  type OperationalSignatureRequestRow,
} from './operational-signature-types'

export async function listPendingOperationalSignatures(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    studyId?: string | null
    assignedUserId?: string | null
    limit?: number
  },
): Promise<OperationalSignatureRequestRow[]> {
  let query = supabase
    .from('operational_signature_requests')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(input.limit ?? 100)

  if (input.studyId) query = query.eq('study_id', input.studyId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row) => {
      if (!input.assignedUserId) return true
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
      return !metadata.requested_to || metadata.requested_to === input.assignedUserId
    })
    .map((row) => mapOperationalSignatureRequestRow(row as Record<string, unknown>))
}
