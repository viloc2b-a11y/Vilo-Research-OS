import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoordinatorRecruitmentStats = {
  actor_id: string
  leads_assigned: number
  leads_advanced_in_period: number
  contact_attempts_in_period: number
  pre_screens_completed: number
  qualified_in_period: number
  conversion_rate: number
  period_days: number
}

// ---------------------------------------------------------------------------
// loadCoordinatorRecruitmentStats
// ---------------------------------------------------------------------------

export async function loadCoordinatorRecruitmentStats(
  supabase: SupabaseClient,
  organizationId: string,
  actorId: string,
  periodDays = 30,
): Promise<CoordinatorRecruitmentStats> {
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  // leads_assigned: count patient_leads where assigned_user_id = actorId
  const { data: assignedData } = await supabase
    .from('patient_leads')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('assigned_user_id', actorId)
    .is('archived_at', null)

  const leads_assigned = ((assignedData as unknown[] | null) ?? []).length

  // leads_advanced_in_period: count patient_lead_stage_history rows by actor in period
  // We need to filter by organization_id via join to patient_leads.
  // We fetch the history rows for this actor in the period, then cross-reference
  // that the patient_lead's org matches. Since stage history stores organization_id
  // directly (see lead-stage-history.ts), we filter on that.
  const { data: advancedData } = await supabase
    .from('patient_lead_stage_history')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('actor_id', actorId)
    .gte('created_at', periodStart)

  const leads_advanced_in_period = ((advancedData as unknown[] | null) ?? []).length

  // contact_attempts_in_period: patient_lead_contact_log is used in recruitment-actions.ts
  // TODO: query patient_lead_contact_log when exposed as a loader (currently only written to via actions)
  const contact_attempts_in_period = 0

  // pre_screens_completed: stage history transitions TO 'pre_screen' by this actor in period
  const { data: preScreenData } = await supabase
    .from('patient_lead_stage_history')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('actor_id', actorId)
    .eq('to_stage', 'pre_screen')
    .gte('created_at', periodStart)

  const pre_screens_completed = ((preScreenData as unknown[] | null) ?? []).length

  // qualified_in_period: stage history transitions TO 'qualified' by this actor in period
  const { data: qualifiedData } = await supabase
    .from('patient_lead_stage_history')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('actor_id', actorId)
    .eq('to_stage', 'qualified')
    .gte('created_at', periodStart)

  const qualified_in_period = ((qualifiedData as unknown[] | null) ?? []).length

  const conversion_rate = leads_assigned > 0 ? qualified_in_period / leads_assigned : 0

  return {
    actor_id: actorId,
    leads_assigned,
    leads_advanced_in_period,
    contact_attempts_in_period,
    pre_screens_completed,
    qualified_in_period,
    conversion_rate,
    period_days: periodDays,
  }
}
