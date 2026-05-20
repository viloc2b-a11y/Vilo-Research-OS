import { addCalendarDays, todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import type { VisitWindowStatus } from '@/lib/visits/types'

export type VisitWindowValidation = {
  windowStatus: VisitWindowStatus
  isOutsideWindow: boolean
  effectiveScheduledDate: string | null
}

/**
 * Compare coordinator scheduled date (or target) against protocol window.
 * Warning = inside window but within 1 calendar day of window end (reference date).
 */
export function validateVisitWindow(input: {
  scheduledDate: string | null
  targetDate: string | null
  windowStartDate: string
  windowEndDate: string
  referenceDate?: string
}): VisitWindowValidation {
  const effective =
    input.scheduledDate?.trim() || input.targetDate?.trim() || null

  if (!effective) {
    return {
      windowStatus: 'inside_window',
      isOutsideWindow: false,
      effectiveScheduledDate: null,
    }
  }

  const { windowStartDate, windowEndDate } = input
  const ref = input.referenceDate ?? todayIsoDate()

  if (effective < windowStartDate || effective > windowEndDate) {
    return {
      windowStatus: 'outside_window',
      isOutsideWindow: true,
      effectiveScheduledDate: effective,
    }
  }

  const warningThreshold = addCalendarDays(windowEndDate, -1)
  if (ref >= warningThreshold && ref <= windowEndDate) {
    return {
      windowStatus: 'warning',
      isOutsideWindow: false,
      effectiveScheduledDate: effective,
    }
  }

  return {
    windowStatus: 'inside_window',
    isOutsideWindow: false,
    effectiveScheduledDate: effective,
  }
}
