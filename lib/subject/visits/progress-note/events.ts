import {
  CLOSEOUT_CHRONOLOGY_TYPES,
  CLOSEOUT_EVENT_LABELS,
  OPERATIONAL_EVENT_TYPES,
} from '@/lib/operations/event-types'
import { loadOperationalChronology } from '@/lib/operations/loadOperationalChronology'
import { logVisitOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { createServerClient } from '@/lib/supabase/server'

export type CloseoutEventType =
  | 'note_saved'
  | 'coordinator_signed'
  | 'coordinator_reopened'
  | 'investigator_signed'
  | 'investigator_reopened'

export type VisitCloseoutEventRow = {
  id: string
  eventType: CloseoutEventType
  actorName: string | null
  eventAt: string
  reopenReason: string | null
}

const LEGACY_TO_OPERATIONAL: Record<CloseoutEventType, string> = {
  note_saved: OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
  coordinator_signed: OPERATIONAL_EVENT_TYPES.COORDINATOR_SIGNED,
  coordinator_reopened: OPERATIONAL_EVENT_TYPES.CLOSEOUT_REOPENED,
  investigator_signed: OPERATIONAL_EVENT_TYPES.INVESTIGATOR_SIGNED,
  investigator_reopened: OPERATIONAL_EVENT_TYPES.CLOSEOUT_REOPENED,
}

const OPERATIONAL_TO_LEGACY: Record<string, CloseoutEventType> = {
  [OPERATIONAL_EVENT_TYPES.NOTE_ADDED]: 'note_saved',
  [OPERATIONAL_EVENT_TYPES.COORDINATOR_SIGNED]: 'coordinator_signed',
  [OPERATIONAL_EVENT_TYPES.INVESTIGATOR_SIGNED]: 'investigator_signed',
  [OPERATIONAL_EVENT_TYPES.CLOSEOUT_REOPENED]: 'coordinator_reopened',
}

export { CLOSEOUT_EVENT_LABELS }

async function resolveVisitStudyId(visitId: string) {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('visits')
    .select('study_id')
    .eq('id', visitId)
    .maybeSingle()
  return (data?.study_id as string | null) ?? null
}

export async function appendVisitCloseoutEvent(input: {
  organizationId: string
  visitId: string
  eventType: CloseoutEventType
  actorUserId: string
  actorName: string
  reopenReason?: string | null
}) {
  const studyId = await resolveVisitStudyId(input.visitId)
  if (!studyId) throw new Error('Visit not found for chronology.')

  const supabase = await createServerClient()
  const operationalType = LEGACY_TO_OPERATIONAL[input.eventType]

  await logVisitOperationalEvent({
    supabase,
    organizationId: input.organizationId,
    studyId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    eventType: operationalType,
    payload: {
      actor_name: input.actorName,
      reopen_reason: input.reopenReason?.trim() || null,
      closeout_context: input.eventType,
    },
  })
}

export async function loadVisitCloseoutEvents(
  visitId: string,
): Promise<VisitCloseoutEventRow[]> {
  const supabase = await createServerClient()
  const { data: visit } = await supabase
    .from('visits')
    .select('organization_id, study_id')
    .eq('id', visitId)
    .maybeSingle()

  if (!visit) return []

  const rows = await loadOperationalChronology({
    organizationId: visit.organization_id as string,
    visitId,
    eventTypes: [...CLOSEOUT_CHRONOLOGY_TYPES],
    limit: 100,
  })

  return rows
    .map((row) => {
      const legacy =
        (row.payload.closeout_context as CloseoutEventType | undefined) ??
        OPERATIONAL_TO_LEGACY[row.eventType]
      if (!legacy) return null
      return {
        id: row.id,
        eventType: legacy,
        actorName: (row.payload.actor_name as string | null) ?? null,
        eventAt: row.occurredAt,
        reopenReason: (row.payload.reopen_reason as string | null) ?? null,
      }
    })
    .filter((row): row is VisitCloseoutEventRow => row !== null)
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt))
}
