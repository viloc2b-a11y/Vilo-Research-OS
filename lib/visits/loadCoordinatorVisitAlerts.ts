import { visitDetailPath } from '@/lib/ops/paths'
import { addCalendarDays, todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { isApproachingVisit } from '@/lib/visits/loadSubjectVisitSchedule'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import type { CoordinatorVisitAlert } from '@/lib/visits/types'
import { createServerClient } from '@/lib/supabase/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadCoordinatorVisitAlerts(
  organizationIds: string[],
): Promise<CoordinatorVisitAlert[]> {
  if (organizationIds.length === 0) return []

  const supabase = await createServerClient()
  const ref = todayIsoDate()
  const inThreeDays = addCalendarDays(ref, 3)

  const { data: rows, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      organization_id,
      study_id,
      study_subject_id,
      target_date,
      scheduled_date,
      window_start,
      window_end,
      visit_status,
      window_status,
      confirmation_status,
      sms_reminder_sent_at,
      study_subjects(subject_identifier),
      visit_definitions(code, label)
    `,
    )
    .in('organization_id', organizationIds)
    .or(
      `scheduled_date.lte.${inThreeDays},window_end.lte.${inThreeDays},visit_status.eq.out_of_window,visit_status.eq.missed`,
    )
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(80)

  if (error || !rows?.length) return []

  const alerts: CoordinatorVisitAlert[] = []

  for (const visit of rows) {
    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const def = one(visit.visit_definitions) as { code?: string; label?: string } | null
    const visitLabel = def?.label ?? def?.code ?? 'Visit'
    const subjectIdentifier = subject?.subject_identifier ?? 'Subject'
    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string
    const href = visitDetailPath(visitId)

    const scheduledDate = (visit.scheduled_date as string | null) ?? null
    const targetDate = (visit.target_date as string | null) ?? null
    const windowEnd = (visit.window_end as string | null) ?? null

    const refreshed = refreshVisitOperationalFields({
      visitStatus: visit.visit_status as string,
      scheduledDate,
      targetDate,
      windowStartDate: (visit.window_start as string | null) ?? null,
      windowEndDate: windowEnd,
      actualDate: null,
      completedAt: null,
      referenceDate: ref,
    })

    const base = {
      visitId,
      studyId,
      subjectId,
      subjectIdentifier,
      visitLabel,
      scheduledDate,
      targetDate,
      windowEndDate: windowEnd,
      href,
    }

    if (refreshed.visitStatus === 'missed') {
      alerts.push({
        id: `missed-${visitId}`,
        alertType: 'missed',
        ...base,
        message: `${visitLabel} for ${subjectIdentifier} was missed (window closed).`,
      })
      continue
    }

    if (
      visit.visit_status === 'out_of_window' ||
      visit.window_status === 'outside_window'
    ) {
      alerts.push({
        id: `oow-${visitId}`,
        alertType: 'out_of_window',
        ...base,
        message: `${visitLabel} for ${subjectIdentifier} is scheduled outside protocol window.`,
      })
    }

    if (isApproachingVisit(scheduledDate, ref)) {
      const needsReminder =
        visit.confirmation_status !== 'reminder_sent' && !visit.sms_reminder_sent_at
      alerts.push({
        id: `approach-${visitId}`,
        alertType: needsReminder ? 'reminder_pending' : 'approaching',
        ...base,
        message: needsReminder
          ? `${visitLabel} for ${subjectIdentifier} is in 2 days — reminder pending.`
          : `${visitLabel} for ${subjectIdentifier} is approaching (${scheduledDate}).`,
      })
    }

    if (!scheduledDate && windowEnd && windowEnd <= addCalendarDays(ref, 7)) {
      alerts.push({
        id: `overdue-sched-${visitId}`,
        alertType: 'overdue_scheduling',
        ...base,
        message: `${visitLabel} for ${subjectIdentifier} needs a scheduled date before window closes.`,
      })
    }
  }

  const seen = new Set<string>()
  return alerts.filter((a) => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })
}
