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

  // contact_attempts_in_period: count contact log entries by this actor in the period.
  // patient_lead_contact_log has organization_id directly (migration 0217).
  const { data: contactLogData } = await supabase
    .from('patient_lead_contact_log')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('actor_user_id', actorId)
    .gte('attempted_at', periodStart)

  const contact_attempts_in_period = ((contactLogData as unknown[] | null) ?? []).length

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

// ---------------------------------------------------------------------------
// loadAllCoordinatorRecruitmentStats
// ---------------------------------------------------------------------------

/**
 * Returns one CoordinatorRecruitmentStats per coordinator who has at least one
 * non-archived patient lead assigned in the given organization.
 */
export async function loadAllCoordinatorRecruitmentStats(
  supabase: SupabaseClient,
  organizationId: string,
  periodDays = 30,
): Promise<CoordinatorRecruitmentStats[]> {
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  // Step 1: leads_assigned — all non-archived leads grouped by assigned_user_id.
  // Supabase JS does not support GROUP BY natively; we fetch the relevant columns
  // and aggregate in memory.
  const { data: leadsData } = await supabase
    .from('patient_leads')
    .select('assigned_user_id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .not('assigned_user_id', 'is', null)

  const leadsRows = (leadsData as Array<{ assigned_user_id: string }> | null) ?? []

  // Tally leads_assigned per actor.
  const leadsAssignedMap = new Map<string, number>()
  for (const row of leadsRows) {
    if (row.assigned_user_id) {
      leadsAssignedMap.set(row.assigned_user_id, (leadsAssignedMap.get(row.assigned_user_id) ?? 0) + 1)
    }
  }

  const actorIds = [...leadsAssignedMap.keys()]
  if (actorIds.length === 0) return []

  // Step 2: stage history stats in period — fetch all rows for this org in period
  // and aggregate in memory to avoid N+1 queries.
  const { data: historyData } = await supabase
    .from('patient_lead_stage_history')
    .select('actor_id, to_stage')
    .eq('organization_id', organizationId)
    .gte('created_at', periodStart)

  const historyRows =
    (historyData as Array<{ actor_id: string; to_stage: string }> | null) ?? []

  // Aggregate per actor.
  const advancedMap = new Map<string, number>()
  const preScreenMap = new Map<string, number>()
  const qualifiedMap = new Map<string, number>()

  for (const row of historyRows) {
    if (!row.actor_id) continue
    advancedMap.set(row.actor_id, (advancedMap.get(row.actor_id) ?? 0) + 1)
    if (row.to_stage === 'pre_screen') {
      preScreenMap.set(row.actor_id, (preScreenMap.get(row.actor_id) ?? 0) + 1)
    }
    if (row.to_stage === 'qualified') {
      qualifiedMap.set(row.actor_id, (qualifiedMap.get(row.actor_id) ?? 0) + 1)
    }
  }

  // Step 2b: contact_attempts_in_period — fetch contact log entries for this org in the period.
  // patient_lead_contact_log.organization_id is available directly (migration 0217).
  const { data: contactLogData } = await supabase
    .from('patient_lead_contact_log')
    .select('actor_user_id')
    .eq('organization_id', organizationId)
    .gte('attempted_at', periodStart)

  const contactLogRows =
    (contactLogData as Array<{ actor_user_id: string }> | null) ?? []

  const contactAttemptsMap = new Map<string, number>()
  for (const row of contactLogRows) {
    if (row.actor_user_id) {
      contactAttemptsMap.set(
        row.actor_user_id,
        (contactAttemptsMap.get(row.actor_user_id) ?? 0) + 1,
      )
    }
  }

  // Step 3: Merge and return one entry per actor with assigned leads.
  return actorIds.map((actorId) => {
    const leads_assigned = leadsAssignedMap.get(actorId) ?? 0
    const leads_advanced_in_period = advancedMap.get(actorId) ?? 0
    const pre_screens_completed = preScreenMap.get(actorId) ?? 0
    const qualified_in_period = qualifiedMap.get(actorId) ?? 0
    const conversion_rate = leads_assigned > 0 ? qualified_in_period / leads_assigned : 0
    const contact_attempts_in_period = contactAttemptsMap.get(actorId) ?? 0

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
  })
}
