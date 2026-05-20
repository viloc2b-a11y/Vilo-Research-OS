import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { validateVisitWindow } from '@/lib/visits/validateVisitWindow'
import type { VisitScheduleStatus, VisitWindowStatus } from '@/lib/visits/types'

const TERMINAL = new Set<VisitScheduleStatus>(['completed', 'cancelled', 'locked'])

export function deriveVisitStatusAfterSchedule(input: {
  currentStatus: string
  windowStatus: VisitWindowStatus
  isOutsideWindow: boolean
  allowOutOfWindowStatus: boolean
}): string {
  if (TERMINAL.has(input.currentStatus as VisitScheduleStatus)) {
    return input.currentStatus
  }
  if (input.isOutsideWindow && input.allowOutOfWindowStatus) {
    return 'out_of_window'
  }
  if (input.currentStatus === 'out_of_window' && !input.isOutsideWindow) {
    return 'scheduled'
  }
  if (input.currentStatus === 'missed' && !input.isOutsideWindow) {
    return 'scheduled'
  }
  return input.currentStatus === 'confirmed' ? 'confirmed' : 'scheduled'
}

export function refreshVisitOperationalFields(input: {
  visitStatus: string
  scheduledDate: string | null
  targetDate: string | null
  windowStartDate: string | null
  windowEndDate: string | null
  actualDate: string | null
  completedAt: string | null
  referenceDate?: string
}): {
  windowStatus: VisitWindowStatus
  visitStatus: string
  isMissed: boolean
} {
  const ref = input.referenceDate ?? todayIsoDate()
  const windowStart = input.windowStartDate ?? input.targetDate
  const windowEnd = input.windowEndDate ?? input.targetDate

  if (!windowStart || !windowEnd) {
    return {
      windowStatus: 'inside_window',
      visitStatus: input.visitStatus,
      isMissed: false,
    }
  }

  const validation = validateVisitWindow({
    scheduledDate: input.scheduledDate,
    targetDate: input.targetDate,
    windowStartDate: windowStart,
    windowEndDate: windowEnd,
    referenceDate: ref,
  })

  const completed =
    input.visitStatus === 'completed' ||
    Boolean(input.completedAt) ||
    Boolean(input.actualDate)

  if (completed) {
    return {
      windowStatus: validation.windowStatus,
      visitStatus: 'completed',
      isMissed: false,
    }
  }

  if (
    TERMINAL.has(input.visitStatus as VisitScheduleStatus) &&
    input.visitStatus !== 'out_of_window'
  ) {
    return {
      windowStatus: validation.windowStatus,
      visitStatus: input.visitStatus,
      isMissed: input.visitStatus === 'missed',
    }
  }

  const pastWindow = ref > windowEnd
  const isMissed =
    pastWindow &&
    !completed &&
    input.visitStatus !== 'cancelled' &&
    input.visitStatus !== 'locked'

  let visitStatus = input.visitStatus
  if (isMissed) {
    visitStatus = 'missed'
  } else {
    visitStatus = deriveVisitStatusAfterSchedule({
      currentStatus: input.visitStatus,
      windowStatus: validation.windowStatus,
      isOutsideWindow: validation.isOutsideWindow,
      allowOutOfWindowStatus: validation.isOutsideWindow,
    })
  }

  return {
    windowStatus: validation.windowStatus,
    visitStatus,
    isMissed,
  }
}
