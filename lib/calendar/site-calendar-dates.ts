/**
 * Site calendar dates — date-only and zoned-local semantics for Operational Calendar.
 * Default site timezone: America/Chicago (override via NEXT_PUBLIC_SITE_TIMEZONE).
 */

export const DEFAULT_SITE_TIMEZONE = 'America/Chicago'

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getSiteTimeZone(): string {
  const fromEnv =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_TIMEZONE?.trim()) ||
    (typeof process !== 'undefined' && process.env.SITE_TIMEZONE?.trim()) ||
    ''
  return fromEnv || DEFAULT_SITE_TIMEZONE
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    weekday: WEEKDAY_TO_INDEX[weekdayLabel] ?? 0,
  }
}

/** Calendar date (YYYY-MM-DD) for an instant in the site timezone. */
export function calendarDateInTimeZone(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function todayCalendarDate(timeZone: string, reference = new Date()): string {
  return calendarDateInTimeZone(reference, timeZone)
}

/** Pure calendar-day arithmetic (no timezone) for YYYY-MM-DD strings. */
export function addCalendarDaysIso(isoDate: string, dayOffset: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  cursor.setUTCDate(cursor.getUTCDate() + dayOffset)
  return cursor.toISOString().slice(0, 10)
}

export function calendarDayDiff(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00.000Z`).getTime()
  const to = new Date(`${toIso}T12:00:00.000Z`).getTime()
  return Math.round((to - from) / 86400000)
}

export function eachCalendarDateInclusive(startDate: string, endDate: string): string[] {
  if (endDate < startDate) return []
  const dates: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    dates.push(cursor)
    cursor = addCalendarDaysIso(cursor, 1)
  }
  return dates
}

/** UTC instant for a wall-clock date/time in the site timezone. */
export function zonedLocalDateTimeToUtcIso(
  dateIso: string,
  timeHm: string,
  timeZone: string,
): string {
  const [hour, minute] = timeHm.split(':').map((value) => Number(value))
  const [year, month, day] = dateIso.split('-').map((value) => Number(value))
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const zoned = zonedParts(new Date(guess), timeZone)
    const dayKey = year * 10000 + month * 100 + day
    const zonedDayKey = zoned.year * 10000 + zoned.month * 100 + zoned.day
    const targetMinutes = hour * 60 + minute
    const zonedMinutes = zoned.hour * 60 + zoned.minute
    const deltaMinutes = (dayKey - zonedDayKey) * 1440 + (targetMinutes - zonedMinutes)
    if (deltaMinutes === 0) {
      return new Date(guess).toISOString()
    }
    guess += deltaMinutes * 60 * 1000
  }

  return new Date(guess).toISOString()
}

/** Inclusive calendar dates between two instants, using site timezone boundaries. */
export function eachCalendarDateBetweenInstants(
  startIso: string,
  endIso: string,
  timeZone: string,
): string[] {
  const startDate = calendarDateInTimeZone(new Date(startIso), timeZone)
  let endDate = calendarDateInTimeZone(new Date(endIso), timeZone)
  if (endIso.endsWith('T00:00:00.000Z') || endIso.endsWith('T00:00:00Z')) {
    endDate = addCalendarDaysIso(endDate, -1)
  }
  return eachCalendarDateInclusive(startDate, endDate)
}

export function weekdayInTimeZone(isoDate: string, timeZone: string): number {
  const noonUtc = zonedLocalDateTimeToUtcIso(isoDate, '12:00', timeZone)
  return zonedParts(new Date(noonUtc), timeZone).weekday
}

export function monthStartIso(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

export function monthEndIso(year: number, monthIndex: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export function buildMonthGridDates(year: number, monthIndex: number, timeZone: string): string[] {
  const start = monthStartIso(year, monthIndex)
  const end = monthEndIso(year, monthIndex)
  const leading = weekdayInTimeZone(start, timeZone)
  const firstGrid = addCalendarDaysIso(start, -leading)
  const trailing = weekdayInTimeZone(end, timeZone)
  const lastGrid = addCalendarDaysIso(end, 6 - trailing)

  const dates: string[] = []
  let cursor = firstGrid
  while (cursor <= lastGrid) {
    dates.push(cursor)
    cursor = addCalendarDaysIso(cursor, 1)
  }
  return dates
}

export function sameCalendarMonth(iso: string, year: number, monthIndex: number): boolean {
  return iso.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

export function allDayBlockRange(
  startDate: string,
  endDate: string,
  timeZone: string,
): { start: string; end: string } {
  return {
    start: zonedLocalDateTimeToUtcIso(startDate, '00:00', timeZone),
    end: zonedLocalDateTimeToUtcIso(addCalendarDaysIso(endDate, 1), '00:00', timeZone),
  }
}

export function manualEventDayRange(
  eventDate: string,
  eventTime: string | null,
  timeZone: string,
): { start: string; end: string } {
  if (!eventTime) {
    return allDayBlockRange(eventDate, eventDate, timeZone)
  }
  const start = zonedLocalDateTimeToUtcIso(eventDate, eventTime, timeZone)
  const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString()
  return { start, end }
}

export function timedBlockRange(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  timeZone: string,
): { start: string; end: string } {
  return {
    start: zonedLocalDateTimeToUtcIso(startDate, startTime, timeZone),
    end: zonedLocalDateTimeToUtcIso(endDate, endTime, timeZone),
  }
}

/** Legacy blocks stored with UTC-midnight date strings (pre–site-TZ hardening). */
export function legacyUtcMidnightAllDayDates(startDatetime: string, endDatetime: string): string[] | null {
  if (!startDatetime.endsWith('T00:00:00.000Z') && !startDatetime.endsWith('T00:00:00Z')) return null
  if (!endDatetime.endsWith('T00:00:00.000Z') && !endDatetime.endsWith('T00:00:00Z')) return null
  const start = startDatetime.slice(0, 10)
  const end = addCalendarDaysIso(endDatetime.slice(0, 10), -1)
  return eachCalendarDateInclusive(start, end)
}

export function allDayStartDate(
  startDatetime: string,
  timeZone: string,
  explicitStartDate?: string | null,
): string {
  if (explicitStartDate) return explicitStartDate
  if (startDatetime.endsWith('T00:00:00.000Z') || startDatetime.endsWith('T00:00:00Z')) {
    return startDatetime.slice(0, 10)
  }
  return calendarDateInTimeZone(new Date(startDatetime), timeZone)
}

export function allDayInclusiveEndDate(
  endDatetime: string,
  timeZone: string,
  explicitEndDate?: string | null,
): string {
  if (explicitEndDate) return explicitEndDate
  if (endDatetime.endsWith('T00:00:00.000Z') || endDatetime.endsWith('T00:00:00Z')) {
    return addCalendarDaysIso(endDatetime.slice(0, 10), -1)
  }
  const endCalendar = calendarDateInTimeZone(new Date(endDatetime), timeZone)
  const exclusiveBoundary = zonedLocalDateTimeToUtcIso(endCalendar, '00:00', timeZone)
  if (new Date(exclusiveBoundary).getTime() === new Date(endDatetime).getTime()) {
    return addCalendarDaysIso(endCalendar, -1)
  }
  return endCalendar
}

export function formatTimeHmInSiteZone(instantIso: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date(instantIso))
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

export function formatZonedTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string,
  allDay: boolean,
): string {
  if (allDay) return 'All day'
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${formatter.format(new Date(startIso))} – ${formatter.format(new Date(endIso))}`
}
