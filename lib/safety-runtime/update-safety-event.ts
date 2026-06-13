import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSafetyEventRow,
  type SafetyEventRow,
  type UpdateSafetyEventInput,
} from './safety-types'

export async function updateSafetyEvent(
  supabase: SupabaseClient,
  eventId: string,
  organizationId: string,
  actorId: string,
  input: UpdateSafetyEventInput,
): Promise<SafetyEventRow> {
  const payload: Record<string, unknown> = {
    updated_by: actorId,
  }

  if (input.eventStatus !== undefined) {
    payload.event_status = input.eventStatus
  }

  if (input.description !== undefined) {
    payload.description = input.description
  }

  if (input.severity !== undefined) {
    payload.severity = input.severity
  }

  if (input.relatedness !== undefined) {
    payload.relatedness = input.relatedness
  }

  if (input.requiresFollowUp !== undefined) {
    payload.requires_follow_up = input.requiresFollowUp
  }

  if (input.closedAt !== undefined) {
    payload.closed_at = input.closedAt
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  const { data, error } = await supabase
    .from('safety_events')
    .update(payload)
    .eq('id', eventId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update safety event: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapSafetyEventRow(data as Record<string, unknown>)
}
