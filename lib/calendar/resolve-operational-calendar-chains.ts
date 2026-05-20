/**
 * Resolves append-only operational calendar event chains by created_at, not occurred_at.
 * occurred_at on each row should match the scheduled/display instant (not the mutation clock).
 */

import { getSiteTimeZone, zonedLocalDateTimeToUtcIso } from '@/lib/calendar/site-calendar-dates'

export type CalendarChainRow = {
  id: string
  event_type: string
  payload: Record<string, unknown> | null
  occurred_at: string
  created_at?: string | null
}

export function sortCalendarChainRowsByCreatedAt<T extends CalendarChainRow>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(a.created_at ?? a.occurred_at).getTime()
      - new Date(b.created_at ?? b.occurred_at).getTime(),
  )
}

function payloadOf(row: CalendarChainRow): Record<string, unknown> {
  return row.payload ?? {}
}

export function isManualCalendarCreation(row: CalendarChainRow): boolean {
  const payload = payloadOf(row)
  if (payload.calendar_event_type !== 'manual') return false
  return (
    row.event_type === 'OPERATIONAL_CALENDAR_MANUAL_EVENT'
    || row.event_type === 'manual_calendar_event_created'
    || payload.manual_event_action === 'created'
  )
}

export function isManualCalendarMutation(row: CalendarChainRow): boolean {
  return (
    row.event_type === 'manual_calendar_event_updated'
    || row.event_type === 'manual_calendar_event_completed'
    || row.event_type === 'manual_calendar_event_cancelled'
  )
}

export type ResolvedManualCalendarEvent<T extends CalendarChainRow = CalendarChainRow> = {
  row: T
  payload: Record<string, unknown>
  status: 'upcoming' | 'completed'
  cancelled: boolean
  completedAt: string | null
  completionNotes: string | null
}

export function resolveManualCalendarEvents<T extends CalendarChainRow>(
  rows: T[],
): ResolvedManualCalendarEvent<T>[] {
  const creations = rows.filter(isManualCalendarCreation)
  const mutations = rows.filter(isManualCalendarMutation)
  const resolved = new Map<string, ResolvedManualCalendarEvent<T>>()

  for (const row of creations) {
    const payload = payloadOf(row)
    resolved.set(row.id, {
      row,
      payload,
      status: 'upcoming',
      cancelled: false,
      completedAt: null,
      completionNotes: null,
    })
  }

  for (const row of sortCalendarChainRowsByCreatedAt(mutations)) {
    const payload = payloadOf(row)
    const originalEventId =
      typeof payload.original_event_id === 'string' ? payload.original_event_id : null
    if (!originalEventId) continue

    const current = resolved.get(originalEventId)
    if (!current) continue

    if (row.event_type === 'manual_calendar_event_updated' && payload.manual_event_action === 'updated') {
      resolved.set(originalEventId, {
        ...current,
        payload: {
          ...current.payload,
          ...payload,
        },
      })
      continue
    }

    if (row.event_type === 'manual_calendar_event_completed' && payload.manual_event_action === 'completed') {
      resolved.set(originalEventId, {
        ...current,
        status: 'completed',
        completedAt:
          typeof payload.completed_at === 'string' ? payload.completed_at : row.occurred_at,
        completionNotes:
          typeof payload.completion_notes === 'string' ? payload.completion_notes : null,
      })
      continue
    }

    if (row.event_type === 'manual_calendar_event_cancelled' && payload.manual_event_action === 'cancelled') {
      resolved.set(originalEventId, {
        ...current,
        cancelled: true,
      })
    }
  }

  return [...resolved.values()]
}

export function filterManualCalendarChainRows<T extends CalendarChainRow>(
  rows: T[],
  originalEventId: string,
): T[] {
  return rows.filter((row) => {
    if (row.id === originalEventId && isManualCalendarCreation(row)) return true
    const payload = payloadOf(row)
    return payload.original_event_id === originalEventId
  })
}

export function resolveManualCalendarEventById<T extends CalendarChainRow>(
  rows: T[],
  originalEventId: string,
): ResolvedManualCalendarEvent<T> | null {
  const chainRows = filterManualCalendarChainRows(rows, originalEventId)
  return resolveManualCalendarEvents(chainRows).find((resolved) => resolved.row.id === originalEventId) ?? null
}

/** Align operational_events.occurred_at with the manual event's scheduled calendar date/time. */
export function manualEventScheduleOccurredAt(
  payload: Record<string, unknown>,
  fallbackOccurredAt: string,
  timeZone: string = getSiteTimeZone(),
): string {
  const eventDate = typeof payload.event_date === 'string' ? payload.event_date : null
  if (!eventDate) return fallbackOccurredAt
  const eventTime = typeof payload.event_time === 'string' ? payload.event_time : '12:00'
  return zonedLocalDateTimeToUtcIso(eventDate, eventTime, timeZone)
}

export function isAvailabilityBlockCreation(row: CalendarChainRow): boolean {
  const payload = payloadOf(row)
  return (
    row.event_type === 'calendar_availability_block_created'
    && payload.calendar_event_type === 'availability_block'
  )
}

export function isAvailabilityBlockMutation(row: CalendarChainRow): boolean {
  return (
    row.event_type === 'calendar_availability_block_updated'
    || row.event_type === 'calendar_availability_block_cancelled'
  )
}

export type ResolvedAvailabilityBlockChain<T extends CalendarChainRow = CalendarChainRow> = {
  id: string
  row: T
  payload: Record<string, unknown>
  cancelled: boolean
}

export function resolveAvailabilityBlockChains<T extends CalendarChainRow>(
  rows: T[],
): ResolvedAvailabilityBlockChain<T>[] {
  const creations = rows.filter(isAvailabilityBlockCreation)
  const mutations = rows.filter(isAvailabilityBlockMutation)
  const resolved = new Map<string, ResolvedAvailabilityBlockChain<T>>()

  for (const row of creations) {
    const payload = payloadOf(row)
    resolved.set(row.id, {
      id: row.id,
      row,
      payload,
      cancelled: false,
    })
  }

  for (const row of sortCalendarChainRowsByCreatedAt(mutations)) {
    const payload = payloadOf(row)
    const originalBlockId =
      typeof payload.original_block_id === 'string' ? payload.original_block_id : null
    if (!originalBlockId) continue

    const current = resolved.get(originalBlockId)
    if (!current) continue

    if (
      row.event_type === 'calendar_availability_block_updated'
      && payload.availability_block_action === 'updated'
    ) {
      resolved.set(originalBlockId, {
        ...current,
        payload: {
          ...current.payload,
          ...payload,
        },
      })
      continue
    }

    if (
      row.event_type === 'calendar_availability_block_cancelled'
      && payload.availability_block_action === 'cancelled'
    ) {
      resolved.set(originalBlockId, {
        ...current,
        cancelled: true,
      })
    }
  }

  return [...resolved.values()]
}

export function filterAvailabilityBlockChainRows<T extends CalendarChainRow>(
  rows: T[],
  originalBlockId: string,
): T[] {
  return rows.filter((row) => {
    if (row.id === originalBlockId && isAvailabilityBlockCreation(row)) return true
    const payload = payloadOf(row)
    return payload.original_block_id === originalBlockId
  })
}

export function resolveAvailabilityBlockChainById<T extends CalendarChainRow>(
  rows: T[],
  originalBlockId: string,
): ResolvedAvailabilityBlockChain<T> | null {
  const chainRows = filterAvailabilityBlockChainRows(rows, originalBlockId)
  return resolveAvailabilityBlockChains(chainRows).find((resolved) => resolved.id === originalBlockId) ?? null
}

/** Align operational_events.occurred_at with the block's scheduled start instant. */
export function availabilityBlockScheduleOccurredAt(
  payload: Record<string, unknown>,
  fallbackOccurredAt: string,
): string {
  const startDatetime = typeof payload.start_datetime === 'string' ? payload.start_datetime : null
  return startDatetime ?? fallbackOccurredAt
}
