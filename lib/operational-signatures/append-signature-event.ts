import type { SupabaseClient } from '@supabase/supabase-js'
import { mapOperationalSignatureEventRow, type OperationalSignatureEventRow } from './operational-signature-types'

export async function appendOperationalSignatureEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    studyId: string
    requestId?: string | null
    signatureId?: string | null
    eventType: string
    eventPayload?: Record<string, unknown>
    actorUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<OperationalSignatureEventRow> {
  const { data, error } = await supabase
    .from('operational_signature_events')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      request_id: input.requestId ?? null,
      signature_id: input.signatureId ?? null,
      event_type: input.eventType,
      event_payload: input.eventPayload ?? {},
      actor_user_id: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to append operational signature event')
  }

  return mapOperationalSignatureEventRow(data as Record<string, unknown>)
}
