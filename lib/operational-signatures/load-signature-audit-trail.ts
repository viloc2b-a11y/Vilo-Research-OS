import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapOperationalSignatureEventRow,
  type OperationalSignatureEventRow,
} from './operational-signature-types'

export async function loadOperationalSignatureAuditTrail(
  supabase: SupabaseClient,
  input: {
    requestId: string
    organizationId?: string | null
    studyId?: string | null
  },
): Promise<OperationalSignatureEventRow[]> {
  let query = supabase
    .from('operational_signature_events')
    .select('*')
    .eq('request_id', input.requestId)
    .order('occurred_at', { ascending: true })

  if (input.organizationId) query = query.eq('organization_id', input.organizationId)
  if (input.studyId) query = query.eq('study_id', input.studyId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) =>
    mapOperationalSignatureEventRow(row as Record<string, unknown>),
  )
}
