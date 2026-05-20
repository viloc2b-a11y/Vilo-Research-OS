/**
 * Site calendar date helpers — timezone edge-case checks (no browser).
 */
import {
  addCalendarDaysIso,
  allDayBlockRange,
  buildMonthGridDates,
  calendarDateInTimeZone,
  eachCalendarDateInclusive,
  legacyUtcMidnightAllDayDates,
  todayCalendarDate,
  zonedLocalDateTimeToUtcIso,
} from '../lib/calendar/site-calendar-dates'

function assert(name: string, condition: boolean, detail = '') {
  if (!condition) throw new Error(detail ? `${name}: ${detail}` : name)
  console.log(`PASS  ${name}`)
}

const chicago = 'America/Chicago'

// Fixed instant: 2026-05-19 06:00 UTC = 2026-05-19 01:00 CDT
const earlyUtc = new Date('2026-05-19T06:00:00.000Z')
assert('calendar date in Chicago (early UTC)', calendarDateInTimeZone(earlyUtc, chicago) === '2026-05-19')

// 2026-05-19 04:00 UTC = 2026-05-18 23:00 CDT — still prior calendar day in Chicago
const priorDayUtc = new Date('2026-05-19T04:00:00.000Z')
assert('UTC date slice would be wrong', priorDayUtc.toISOString().slice(0, 10) === '2026-05-19')
assert('site calendar date correct', calendarDateInTimeZone(priorDayUtc, chicago) === '2026-05-18')

const singleDay = allDayBlockRange('2026-05-19', '2026-05-19', chicago)
assert(
  'single all-day expands to one calendar date',
  eachCalendarDateInclusive('2026-05-19', '2026-05-19').length === 1,
)
assert(
  'all-day end is exclusive local midnight',
  calendarDateInTimeZone(new Date(singleDay.end), chicago) === '2026-05-20',
)

allDayBlockRange('2026-05-19', '2026-05-21', chicago)
const multiDates = eachCalendarDateInclusive('2026-05-19', '2026-05-21')
assert('multi-day inclusive range', multiDates.join(',') === '2026-05-19,2026-05-20,2026-05-21')
assert(
  'legacy UTC midnight all-day preserved',
  legacyUtcMidnightAllDayDates('2026-05-19T00:00:00.000Z', '2026-05-22T00:00:00.000Z')?.join(',') ===
    '2026-05-19,2026-05-20,2026-05-21',
)

const timedStart = zonedLocalDateTimeToUtcIso('2026-05-19', '09:00', chicago)
assert(
  'timed local 09:00 maps to expected calendar date',
  calendarDateInTimeZone(new Date(timedStart), chicago) === '2026-05-19',
)

const mayGrid = buildMonthGridDates(2026, 4, chicago) // May 2026
assert('May grid includes May 1', mayGrid.includes('2026-05-01'))
assert('May grid starts on Sunday column', mayGrid[0] === '2026-04-26')

assert('today is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(todayCalendarDate(chicago)))
assert('add calendar days', addCalendarDaysIso('2026-05-19', 1) === '2026-05-20')

console.log('\nSite calendar date validation passed.')
