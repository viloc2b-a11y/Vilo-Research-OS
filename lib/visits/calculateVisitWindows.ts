/**
 * Protocol visit window math from schedule anchor + target day offsets.
 */

export function addCalendarDays(isoDate: string, dayOffset: number): string {
  const base = new Date(`${isoDate}T12:00:00`)
  base.setDate(base.getDate() + dayOffset)
  return base.toISOString().slice(0, 10)
}

export function todayIsoDate(reference = new Date()): string {
  return reference.toISOString().slice(0, 10)
}

export type VisitWindowCalculation = {
  visitDay: number
  targetDate: string
  windowStartDate: string
  windowEndDate: string
}

export function calculateVisitWindows(input: {
  anchorDate: string
  targetDay: number
  windowMinOffset?: number | null
  windowMaxOffset?: number | null
}): VisitWindowCalculation {
  const visitDay = Math.max(1, Math.trunc(input.targetDay))
  const minOffset = input.windowMinOffset ?? -1
  const maxOffset = input.windowMaxOffset ?? 2
  const targetDate = addCalendarDays(input.anchorDate, visitDay - 1)
  return {
    visitDay,
    targetDate,
    windowStartDate: addCalendarDays(targetDate, minOffset),
    windowEndDate: addCalendarDays(targetDate, maxOffset),
  }
}
