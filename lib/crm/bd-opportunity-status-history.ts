import type { SupabaseClient } from '@supabase/supabase-js'

export type BdOpportunityStatusTransitionArgs = {
  supabase: SupabaseClient
  organizationId: string
  bdOpportunityId: string
  fromStatus: string | null
  toStatus: string
  actorId: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}

export async function recordOpportunityStatusTransition(
  args: BdOpportunityStatusTransitionArgs,
): Promise<void> {
  const { supabase, organizationId, bdOpportunityId, fromStatus, toStatus, actorId, reason, metadata } = args

  await supabase.from('bd_opportunity_status_history').insert({
    organization_id: organizationId,
    bd_opportunity_id: bdOpportunityId,
    from_status: fromStatus ?? null,
    to_status: toStatus,
    actor_id: actorId ?? null,
    reason: reason ?? null,
    metadata: metadata ?? {},
  })
}

export type BdOpportunityStatusHistoryRow = {
  id: string
  organizationId: string
  bdOpportunityId: string
  fromStatus: string | null
  toStatus: string
  actorId: string | null
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export async function loadOpportunityStatusHistory(
  supabase: SupabaseClient,
  organizationId: string,
  opportunityId: string,
): Promise<BdOpportunityStatusHistoryRow[]> {
  const { data, error } = await supabase
    .from('bd_opportunity_status_history')
    .select('id, organization_id, bd_opportunity_id, from_status, to_status, actor_id, reason, metadata, created_at')
    .eq('organization_id', organizationId)
    .eq('bd_opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    bdOpportunityId: String(row.bd_opportunity_id),
    fromStatus: row.from_status ? String(row.from_status) : null,
    toStatus: String(row.to_status),
    actorId: row.actor_id ? String(row.actor_id) : null,
    reason: row.reason ? String(row.reason) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }))
}
