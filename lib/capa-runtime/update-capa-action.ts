import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapCapaActionRow,
  type CapaActionRow,
  type UpdateCapaActionInput,
} from './capa-types'

export async function updateCapaAction(
  supabase: SupabaseClient,
  actionId: string,
  organizationId: string,
  actorId: string,
  input: UpdateCapaActionInput,
): Promise<CapaActionRow> {
  const payload: Record<string, unknown> = {
    updated_by: actorId,
  }

  if (input.capaStatus !== undefined) {
    payload.capa_status = input.capaStatus
  }

  if (input.ownerId !== undefined) {
    payload.owner_id = input.ownerId
  }

  if (input.rootCauseAnalysis !== undefined) {
    payload.root_cause_analysis = input.rootCauseAnalysis
  }

  if (input.correctiveAction !== undefined) {
    payload.corrective_action = input.correctiveAction
  }

  if (input.preventiveAction !== undefined) {
    payload.preventive_action = input.preventiveAction
  }

  if (input.dueDate !== undefined) {
    payload.due_date = input.dueDate
  }

  if (input.completionDate !== undefined) {
    payload.completion_date = input.completionDate
  }

  if (input.effectivenessCheckRequired !== undefined) {
    payload.effectiveness_check_required = input.effectivenessCheckRequired
  }

  if (input.effectivenessCheckDate !== undefined) {
    payload.effectiveness_check_date = input.effectivenessCheckDate
  }

  if (input.effectivenessCheckResult !== undefined) {
    payload.effectiveness_check_result = input.effectivenessCheckResult
  }

  if (input.effectivenessVerifiedBy !== undefined) {
    payload.effectiveness_verified_by = input.effectivenessVerifiedBy
  }

  if (input.effectivenessNotes !== undefined) {
    payload.effectiveness_notes = input.effectivenessNotes
  }

  if (input.closedBy !== undefined) {
    payload.closed_by = input.closedBy
  }

  if (input.closureNotes !== undefined) {
    payload.closure_notes = input.closureNotes
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  const { data, error } = await supabase
    .from('capa_actions')
    .update(payload)
    .eq('id', actionId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update CAPA action: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapCapaActionRow(data as Record<string, unknown>)
}
