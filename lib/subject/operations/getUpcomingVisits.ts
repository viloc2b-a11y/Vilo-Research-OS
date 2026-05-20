import { sourceCapturePath, visitDetailPath } from '@/lib/ops/paths'
import { addCalendarDays, todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { isApproachingVisit } from '@/lib/visits/loadSubjectVisitSchedule'
import type { UpcomingVisitItem } from '@/lib/subject/operations/types'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

const ACTIVE = new Set(['scheduled', 'confirmed', 'in_progress', 'out_of_window', 'missed'])

function isRelevantUpcoming(v: SubjectVisitGridRow, ref: string, inSeven: string): boolean {
  const needsSchedule = !v.scheduledDate && v.windowEnd && v.windowEnd <= inSeven
  return (
    Boolean(needsSchedule) ||
    v.visitStatus === 'missed' ||
    (v.scheduledDate != null && v.scheduledDate >= ref) ||
    (v.targetDate != null && v.targetDate >= ref) ||
    v.windowStatus === 'warning' ||
    v.windowStatus === 'outside_window'
  )
}

export function getUpcomingVisits(
  visits: SubjectVisitGridRow[],
  _studyId: string,
  limit = 5,
): UpcomingVisitItem[] {
  const ref = todayIsoDate()
  const inSeven = addCalendarDays(ref, 7)

  const items: Array<UpcomingVisitItem & { sortKey: string }> = []

  for (const v of visits) {
    if (!ACTIVE.has(v.visitStatus)) continue
    if (!isRelevantUpcoming(v, ref, inSeven)) continue

    const href = v.primaryProcedureId
      ? sourceCapturePath(v.primaryProcedureId, v.organizationId)
      : visitDetailPath(v.id)
    const needsSchedule = !v.scheduledDate && v.windowEnd && v.windowEnd <= inSeven
    const reminderPending =
      isApproachingVisit(v.scheduledDate, ref) && v.visitStatus !== 'completed'

    items.push({
      visitId: v.id,
      visitName: v.visitName,
      visitDay: v.visitDay,
      targetDate: v.targetDate,
      scheduledDate: v.scheduledDate,
      windowStart: v.windowStart,
      windowEnd: v.windowEnd,
      windowStatus: v.windowStatus,
      reminderStatus: reminderPending ? 'pending' : 'none',
      isOverdueScheduling: Boolean(needsSchedule),
      href,
      sortKey: v.scheduledDate ?? v.targetDate ?? '9999-12-31',
    })
  }

  return items
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, limit)
    .map((item) => {
      const { sortKey, ...rest } = item
      void sortKey
      return rest
    })
}
