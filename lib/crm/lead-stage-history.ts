import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadStageTransitionArgs = {
  supabase: SupabaseClient
  organizationId: string
  leadId: string
  fromStage: string | null
  toStage: string
  actorId: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}

export async function recordLeadStageTransition(args: LeadStageTransitionArgs): Promise<void> {
  const { supabase, organizationId, leadId, fromStage, toStage, actorId, reason, metadata } = args

  await supabase.from('patient_lead_stage_history').insert({
    organization_id: organizationId,
    patient_lead_id: leadId,
    from_stage: fromStage ?? null,
    to_stage: toStage,
    actor_id: actorId ?? null,
    reason: reason ?? null,
    metadata: metadata ?? {},
  })
}

export type LeadStageHistoryRow = {
  id: string
  organizationId: string
  patientLeadId: string
  fromStage: string | null
  toStage: string
  actorId: string | null
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export async function loadLeadStageHistory(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<LeadStageHistoryRow[]> {
  const { data, error } = await supabase
    .from('patient_lead_stage_history')
    .select('id, organization_id, patient_lead_id, from_stage, to_stage, actor_id, reason, metadata, created_at')
    .eq('organization_id', organizationId)
    .eq('patient_lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    patientLeadId: String(row.patient_lead_id),
    fromStage: row.from_stage ? String(row.from_stage) : null,
    toStage: String(row.to_stage),
    actorId: row.actor_id ? String(row.actor_id) : null,
    reason: row.reason ? String(row.reason) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }))
}
