import { addCalendarDays, todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import type { SubjectVisitScheduleItem } from '@/lib/visits/types'
import { createServerClient } from '@/lib/supabase/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadSubjectVisitSchedule(input: {
  studySubjectId: string
  studyId: string
  currentVisitId?: string | null
  organizationId?: string | null
}): Promise<{ visits: SubjectVisitScheduleItem[]; error: string | null }> {
  const supabase = await createServerClient()
  const ref = todayIsoDate()

  let query = supabase
    .from('visits')
    .select(
      `
      id,
      organization_id,
      visit_definition_id,
      visit_day,
      target_date,
      scheduled_date,
      actual_date,
      window_start,
      window_end,
      visit_status,
      window_status,
      confirmation_status,
      visit_definitions(code, label, sort_order, target_day)
    `,
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('study_id', input.studyId)

  if (input.organizationId) {
    query = query.eq('organization_id', input.organizationId)
  }

  const { data: visitsData, error } = await query
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return { visits: [], error: error.message }

  const visitIds = (visitsData ?? []).map((v) => v.id as string)
  const { data: procedures } =
    visitIds.length > 0
      ? await supabase
          .from('procedure_executions')
          .select('id, visit_id')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: true })
      : { data: [] }

  const primaryByVisit = new Map<string, string>()
  for (const proc of procedures ?? []) {
    const vid = proc.visit_id as string
    if (!primaryByVisit.has(vid)) {
      primaryByVisit.set(vid, proc.id as string)
    }
  }

  const visits: SubjectVisitScheduleItem[] = (visitsData ?? []).map((visit) => {
    const def = one(visit.visit_definitions) as {
      code?: string
      label?: string
      target_day?: number | null
      sort_order?: number
    } | null

    const orgId = visit.organization_id as string
    const refreshed = refreshVisitOperationalFields({
      visitStatus: visit.visit_status as string,
      scheduledDate: (visit.scheduled_date as string | null) ?? null,
      targetDate: (visit.target_date as string | null) ?? null,
      windowStartDate: (visit.window_start as string | null) ?? null,
      windowEndDate: (visit.window_end as string | null) ?? null,
      actualDate: (visit.actual_date as string | null) ?? null,
      completedAt: null,
      referenceDate: ref,
    })

    const primaryProcedureId = primaryByVisit.get(visit.id as string) ?? null
    const orgQs = `?organization_id=${orgId}`

    return {
      visitId: visit.id as string,
      visitDefinitionId: visit.visit_definition_id as string,
      visitCode: def?.code ?? '—',
      visitName: def?.label ?? def?.code ?? 'Visit',
      visitDay:
        (visit.visit_day as number | null) ??
        def?.target_day ??
        (typeof def?.sort_order === 'number' ? def.sort_order + 1 : null),
      targetDate: (visit.target_date as string | null) ?? null,
      scheduledDate: (visit.scheduled_date as string | null) ?? null,
      actualVisitDate: (visit.actual_date as string | null) ?? null,
      windowStartDate: (visit.window_start as string | null) ?? null,
      windowEndDate: (visit.window_end as string | null) ?? null,
      visitStatus: refreshed.visitStatus,
      windowStatus: refreshed.windowStatus,
      confirmationStatus:
        (visit.confirmation_status as SubjectVisitScheduleItem['confirmationStatus']) ??
        'pending',
      primaryProcedureId,
      captureHref: primaryProcedureId
        ? `/source/capture/${primaryProcedureId}${orgQs}`
        : null,
      visitDetailHref: `/visits/${visit.id as string}`,
      isCurrent: input.currentVisitId === visit.id,
    }
  })

  return { visits, error: null }
}

/** Visits with scheduled date in [today+1, today+2] for coordinator reminders. */
export function isApproachingVisit(scheduledDate: string | null, reference = todayIsoDate()): boolean {
  if (!scheduledDate) return false
  const inTwoDays = addCalendarDays(reference, 2)
  const tomorrow = addCalendarDays(reference, 1)
  return scheduledDate >= tomorrow && scheduledDate <= inTwoDays
}
