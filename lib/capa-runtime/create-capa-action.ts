import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapCapaActionRow,
  type CapaActionRow,
  type CreateCapaActionInput,
} from './capa-types'

export async function createCapaAction(
  supabase: SupabaseClient,
  actorId: string,
  input: CreateCapaActionInput,
): Promise<CapaActionRow> {
  const now = new Date().toISOString()
  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    deviation_id: input.deviationId,
    capa_status: 'open',
    corrective_action: input.correctiveAction,
    preventive_action: input.preventiveAction ?? null,
    root_cause_analysis: input.rootCauseAnalysis ?? null,
    owner_id: input.ownerId ?? null,
    due_date: input.dueDate ?? null,
    effectiveness_check_required: input.effectivenessCheckRequired ?? false,
    created_by: actorId,
    updated_by: actorId,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('capa_actions')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create CAPA action: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapCapaActionRow(data as Record<string, unknown>)
}
