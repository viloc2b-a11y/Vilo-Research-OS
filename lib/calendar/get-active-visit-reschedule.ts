import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getRescheduleForScheduledVisit,
  resolveProtocolVisitReschedules,
  type ProtocolVisitRescheduleRow,
  type ResolvedProtocolVisitReschedule,
} from '@/lib/visit-schedule/resolve-protocol-visit-reschedules'

export type VisitCalendarReschedule = {
  isActive: boolean
  protocolTargetDate: string
  displayDate: string
  displayTime: string | null
  rescheduledDate: string
  rescheduledTime: string | null
  reason: string | null
  notes: string | null
}

export async function loadActiveProtocolVisitReschedules(
  supabase: SupabaseClient,
  organizationIds: string[],
): Promise<Map<string, ResolvedProtocolVisitReschedule>> {
  if (organizationIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('operational_events')
    .select('id, event_type, payload, occurred_at')
    .in('organization_id', organizationIds)
    .in('event_type', ['protocol_visit_rescheduled', 'protocol_visit_reschedule_cancelled'])
    .order('occurred_at', { ascending: true })
    .limit(2000)

  if (error) return new Map()
  return resolveProtocolVisitReschedules((data ?? []) as ProtocolVisitRescheduleRow[])
}

export async function loadScheduledVisitIdByVisitId(
  supabase: SupabaseClient,
  visitIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (visitIds.length === 0) return map

  const { data, error } = await supabase
    .from('scheduled_visits')
    .select('id, visit_id')
    .in('visit_id', visitIds)
    .not('visit_id', 'is', null)

  if (error) return map
  for (const row of data ?? []) {
    const visitId = row.visit_id as string | null
    if (visitId) map.set(visitId, row.id as string)
  }
  return map
}

export function lookupActiveVisitReschedule(
  rescheduleMap: Map<string, ResolvedProtocolVisitReschedule>,
  lookup: { visitId?: string | null; scheduledVisitId?: string | null },
): ResolvedProtocolVisitReschedule | null {
  if (lookup.scheduledVisitId) {
    const hit = getRescheduleForScheduledVisit(
      rescheduleMap,
      lookup.scheduledVisitId,
      lookup.visitId ?? null,
    )
    if (hit) return hit
  }
  if (lookup.visitId) {
    return rescheduleMap.get(`visit:${lookup.visitId}`) ?? null
  }
  return null
}

export function buildVisitCalendarReschedule(
  protocolTargetDate: string | null,
  resolved: ResolvedProtocolVisitReschedule | null,
): VisitCalendarReschedule | null {
  if (!resolved || !protocolTargetDate) return null
  return {
    isActive: true,
    protocolTargetDate,
    displayDate: resolved.rescheduledDate,
    displayTime: resolved.rescheduledTime,
    rescheduledDate: resolved.rescheduledDate,
    rescheduledTime: resolved.rescheduledTime,
    reason: resolved.reason,
    notes: resolved.notes,
  }
}

export async function loadVisitCalendarReschedule(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    visitId: string
    protocolTargetDate: string | null
  },
): Promise<VisitCalendarReschedule | null> {
  const rescheduleMap = await loadActiveProtocolVisitReschedules(supabase, [input.organizationId])
  const scheduledByVisit = await loadScheduledVisitIdByVisitId(supabase, [input.visitId])
  const scheduledVisitId = scheduledByVisit.get(input.visitId) ?? null
  const resolved = lookupActiveVisitReschedule(rescheduleMap, {
    visitId: input.visitId,
    scheduledVisitId,
  })
  const targetDate =
    input.protocolTargetDate
    ?? resolved?.originalTargetDate
    ?? null
  return buildVisitCalendarReschedule(targetDate, resolved)
}

export function formatRescheduledLabel(reschedule: VisitCalendarReschedule): string {
  const timeSuffix = reschedule.displayTime ? ` at ${reschedule.displayTime}` : ''
  return `Rescheduled: ${reschedule.displayDate}${timeSuffix}`
}

/** Operational scheduling date for display/sort (does not replace protocol target). */
export function visitOperationalDisplayDate(input: {
  targetDate: string | null
  scheduledDate: string | null
  calendarReschedule: VisitCalendarReschedule | null
}): string | null {
  if (input.calendarReschedule?.isActive) return input.calendarReschedule.displayDate
  return input.scheduledDate ?? input.targetDate
}
