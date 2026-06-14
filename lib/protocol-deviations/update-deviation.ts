import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolDeviationRow,
  type ProtocolDeviationRow,
  type UpdateDeviationInput,
} from './deviation-types'

export async function updateDeviation(
  supabase: SupabaseClient,
  deviationId: string,
  organizationId: string,
  actorId: string,
  input: UpdateDeviationInput,
): Promise<ProtocolDeviationRow> {
  const payload: Record<string, unknown> = {
    updated_by: actorId,
  }

  if (input.deviationType !== undefined) {
    payload.deviation_type = input.deviationType
  }

  if (input.status !== undefined) {
    payload.status = input.status
  }

  if (input.severity !== undefined) {
    payload.severity = input.severity
  }

  if (input.description !== undefined) {
    payload.description = input.description
  }

  if (input.rootCause !== undefined) {
    payload.root_cause = input.rootCause
  }

  if (input.correctiveAction !== undefined) {
    payload.corrective_action = input.correctiveAction
  }

  if (input.preventiveAction !== undefined) {
    payload.preventive_action = input.preventiveAction
  }

  if (input.requiresSponsorNotification !== undefined) {
    payload.requires_sponsor_notification = input.requiresSponsorNotification
  }

  if (input.requiresIrbNotification !== undefined) {
    payload.requires_irb_notification = input.requiresIrbNotification
  }

  if (input.closedAt !== undefined) {
    payload.closed_at = input.closedAt
  }

  if (input.supersededBy !== undefined) {
    payload.superseded_by = input.supersededBy
  }

  if (input.reopenedAt !== undefined) {
    payload.reopened_at = input.reopenedAt
  }

  if (input.adjudicatedBy !== undefined) {
    payload.adjudicated_by = input.adjudicatedBy
  }

  if (input.adjudicatedAt !== undefined) {
    payload.adjudicated_at = input.adjudicatedAt
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  const { data, error } = await supabase
    .from('protocol_deviations')
    .update(payload)
    .eq('id', deviationId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update protocol deviation: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapProtocolDeviationRow(data as Record<string, unknown>)
}
