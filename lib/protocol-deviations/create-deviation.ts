import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolDeviationRow,
  type CreateDeviationInput,
  type ProtocolDeviationRow,
} from './deviation-types'

export async function createDeviation(
  supabase: SupabaseClient,
  actorId: string,
  input: CreateDeviationInput,
): Promise<ProtocolDeviationRow> {
  const now = new Date().toISOString()
  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    subject_id: input.subjectId,
    visit_id: input.visitId ?? null,
    deviation_type: input.deviationType,
    status: 'open',
    severity: input.severity,
    description: input.description,
    root_cause: input.rootCause ?? null,
    corrective_action: input.correctiveAction ?? null,
    preventive_action: input.preventiveAction ?? null,
    requires_sponsor_notification: input.requiresSponsorNotification ?? false,
    requires_irb_notification: input.requiresIrbNotification ?? false,
    opened_at: input.openedAt ?? now,
    created_by: actorId,
    updated_by: actorId,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('protocol_deviations')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create protocol deviation: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapProtocolDeviationRow(data as Record<string, unknown>)
}
