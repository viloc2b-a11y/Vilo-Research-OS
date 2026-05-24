import type { ReplayTimelineEntry } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ChronologyRow = {
  id: string
  eventType: string
  payload: Record<string, unknown>
  actorUserId: string | null
  occurredAt: string
  visitId: string | null
  procedureExecutionId: string | null
  studyId: string
}

export async function loadOperationalChronologyForReplay(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitIds?: string[]
  eventTypes?: string[]
  limit?: number
  ascending?: boolean
}): Promise<ChronologyRow[]> {
  let query = input.supabase
    .from('operational_events')
    .select(
      'id, event_type, payload, actor_user_id, occurred_at, visit_id, procedure_execution_id, study_id',
    )
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .order('occurred_at', { ascending: input.ascending ?? true })

  if (input.visitIds?.length) {
    query = query.in('visit_id', input.visitIds)
  }
  if (input.eventTypes?.length) {
    query = query.in('event_type', input.eventTypes)
  }
  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    eventType: row.event_type as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    actorUserId: (row.actor_user_id as string | null) ?? null,
    occurredAt: row.occurred_at as string,
    visitId: (row.visit_id as string | null) ?? null,
    procedureExecutionId: (row.procedure_execution_id as string | null) ?? null,
    studyId: row.study_id as string,
  }))
}

export function chronologyToReplayEntries(
  rows: ChronologyRow[],
  segmentType: ReplayTimelineEntry['segmentType'],
): ReplayTimelineEntry[] {
  return rows.map((row) => {
    const payload = row.payload
    const mutation =
      typeof payload.mutation === 'string'
        ? payload.mutation
        : (payload.details as Record<string, unknown> | undefined)?.mutation
    const detail =
      typeof mutation === 'string'
        ? mutation
        : row.eventType.replace(/_/g, ' ').toLowerCase()

    return {
      id: `event:${row.id}`,
      kind: 'operational_event',
      segmentType,
      occurredAt: row.occurredAt,
      label: row.eventType,
      detail: String(detail),
      eventType: row.eventType,
      visitId: row.visitId,
      procedureExecutionId: row.procedureExecutionId,
      operationalEventId: row.id,
      payload,
    }
  })
}
