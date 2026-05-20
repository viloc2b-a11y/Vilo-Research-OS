import { createServerClient } from '@/lib/supabase/server'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { filterUnblindedRows } from '@/lib/rbac/blinding'

export type OperationalChronologyRow = {
  id: string
  eventType: string
  payload: Record<string, unknown>
  actorUserId: string | null
  occurredAt: string
  visitId: string | null
  procedureExecutionId: string | null
}

export async function loadOperationalChronology(input: {
  organizationId: string
  studyId?: string
  visitId?: string
  procedureExecutionId?: string
  eventTypes?: string[]
  limit?: number
}): Promise<OperationalChronologyRow[]> {
  const supabase = await createServerClient()
  let query = supabase
    .from('operational_events')
    .select('id, event_type, payload, actor_user_id, occurred_at, visit_id, procedure_execution_id')
    .eq('organization_id', input.organizationId)
    .order('occurred_at', { ascending: false })

  if (input.studyId) query = query.eq('study_id', input.studyId)
  if (input.visitId) query = query.eq('visit_id', input.visitId)
  if (input.procedureExecutionId) {
    query = query.eq('procedure_execution_id', input.procedureExecutionId)
  }
  if (input.eventTypes?.length) {
    query = query.in('event_type', input.eventTypes)
  }
  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) return []
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const scopedMemberships = memberships.filter((membership) => membership.organization_id === input.organizationId)

  return filterUnblindedRows(
    ((data ?? []) as Array<{
      id: string
      event_type: string
      payload: Record<string, unknown> | null
      actor_user_id: string | null
      occurred_at: string
      visit_id: string | null
      procedure_execution_id: string | null
    }>),
    scopedMemberships,
  ).map((row) => ({
    id: row.id as string,
    eventType: row.event_type as string,
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    actorUserId: (row.actor_user_id as string | null) ?? null,
    occurredAt: row.occurred_at as string,
    visitId: (row.visit_id as string | null) ?? null,
    procedureExecutionId: (row.procedure_execution_id as string | null) ?? null,
  }))
}
