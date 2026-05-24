import { VISIT_REPLAY_EVENT_TYPES } from '@/lib/runtime-replay/constants'
import {
  chronologyToReplayEntries,
  loadOperationalChronologyForReplay,
} from '@/lib/runtime-replay/load-chronology'
import type { ReplayTimelineSegment } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildVisitExecutionSegment(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<ReplayTimelineSegment> {
  const rows = await loadOperationalChronologyForReplay({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitIds: [input.visitId],
    eventTypes: [...VISIT_REPLAY_EVENT_TYPES],
    limit: 500,
  })

  const visitExecutionTypes = new Set([
    'VISIT_CHECKED_IN',
    'VISIT_RESCHEDULED',
    'VISIT_COMPLETED',
    'VISIT_LOCKED',
    'PROCEDURE_COMPLETED',
    'PROCEDURE_SIGNED',
    'CONDITIONAL_PROCEDURE_INSTANTIATED',
    'SCHEDULE_MATERIALIZED',
  ])

  const filtered = rows.filter((r) => visitExecutionTypes.has(r.eventType))

  const { data: visit } = await input.supabase
    .from('visits')
    .select('visit_status, rescheduled_at')
    .eq('id', input.visitId)
    .maybeSingle()

  const entries = chronologyToReplayEntries(filtered, 'visit_execution')

  if (visit?.visit_status) {
    entries.push({
      id: `execution:visit-status:${input.visitId}`,
      kind: 'execution_fact',
      segmentType: 'visit_execution',
      occurredAt: new Date().toISOString(),
      label: 'Current visit status',
      detail: `Visit is ${visit.visit_status as string}.`,
      visitId: input.visitId,
    })
  }

  return {
    segmentType: 'visit_execution',
    label: 'Visit execution timeline',
    entries: entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  }
}
