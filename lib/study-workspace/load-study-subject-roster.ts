import { createServerClient } from '@/lib/supabase/server'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

const DEFAULT_ROSTER_LIMIT = 50
const ROSTER_VISIT_BATCH_LIMIT = 500

export type StudySubjectRosterRow = {
  subjectId: string
  subjectIdentifier: string
  enrollmentStatus: string
  currentVisitName: string | null
  nextVisitName: string | null
  overdueVisitCount: number
  activeAeCount: number
  activeConMedCount: number
  lastActivityDate: string | null
  hrefSubject: string
}

export async function loadStudySubjectRoster(
  studyId: string,
  organizationId: string,
  limit = DEFAULT_ROSTER_LIMIT,
  searchQuery?: string | null,
): Promise<StudySubjectRosterRow[]> {
  const supabase = await createServerClient()
  const normalizedSearch = searchQuery?.trim() ?? ''
  
  let subjectQuery = supabase
    .from('study_subjects')
    .select(`
      id,
      subject_identifier,
      enrollment_status,
      updated_at
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('subject_identifier', { ascending: true })
    .limit(limit)

  if (normalizedSearch) {
    subjectQuery = subjectQuery.ilike('subject_identifier', `%${normalizedSearch}%`)
  }

  const { data: subjects, error } = await subjectQuery

  if (error || !subjects) return []

  const ref = todayIsoDate()
  const subjectIds = subjects.map((subject) => String(subject.id))
  if (subjectIds.length === 0) return []

  const [
    { data: visits },
    { data: adverseEvents },
    { data: conmeds },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select(`
        id,
        study_subject_id,
        scheduled_date,
        target_date,
        window_start,
        window_end,
        actual_date,
        visit_status,
        visit_definitions ( code, label )
      `)
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('study_subject_id', subjectIds)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .limit(ROSTER_VISIT_BATCH_LIMIT),
    supabase
      .from('subject_adverse_events')
      .select('ae_id, study_subject_id, lifecycle_status')
      .eq('organization_id', organizationId)
      .in('study_subject_id', subjectIds)
      .eq('lifecycle_status', 'open'),
    supabase
      .from('subject_concomitant_medications')
      .select('conmed_id, study_subject_id, ongoing')
      .eq('organization_id', organizationId)
      .in('study_subject_id', subjectIds)
      .eq('ongoing', true),
  ])

  const visitsBySubject = new Map<string, NonNullable<typeof visits>>()
  for (const visit of visits ?? []) {
    const subjectId = String(visit.study_subject_id)
    const rows = visitsBySubject.get(subjectId) ?? []
    rows.push(visit)
    visitsBySubject.set(subjectId, rows)
  }

  const activeAeCountBySubject = countBySubject(adverseEvents ?? [], 'study_subject_id')
  const activeConMedCountBySubject = countBySubject(conmeds ?? [], 'study_subject_id')

  return subjects.map((sub) => {
    let currentVisitName = null
    let nextVisitName = null
    let overdueCount = 0
    let daysOverdue: number | null = null
    let lastActivityDate = sub.updated_at ? sub.updated_at.split('T')[0] : null

    const subjectVisits = visitsBySubject.get(String(sub.id)) ?? []

    for (const v of subjectVisits) {
      const refreshed = refreshVisitOperationalFields({
        visitStatus: String(v.visit_status),
        scheduledDate: (v.scheduled_date as string | null) ?? null,
        targetDate: (v.target_date as string | null) ?? null,
        windowStartDate: (v.window_start as string | null) ?? null,
        windowEndDate: (v.window_end as string | null) ?? null,
        actualDate: (v.actual_date as string | null) ?? null,
        completedAt: null,
        referenceDate: ref
      })

      const def = Array.isArray(v.visit_definitions)
        ? v.visit_definitions[0]
        : v.visit_definitions
      const name = def?.label || def?.code || 'Visit'

      if (v.actual_date && (!lastActivityDate || v.actual_date > lastActivityDate)) {
        lastActivityDate = v.actual_date
      }

      if (refreshed.visitStatus === 'in_progress' || refreshed.visitStatus === 'checked_in') {
        currentVisitName = name
      } else if (!nextVisitName && ['pending', 'scheduled', 'confirmed'].includes(refreshed.visitStatus)) {
        nextVisitName = name
      }

      if (refreshed.windowStatus === 'outside_window' || refreshed.visitStatus === 'missed') {
        overdueCount++
        if (v.window_end && ref > v.window_end) {
          const diff = Math.floor((new Date(ref).getTime() - new Date(v.window_end).getTime()) / (1000 * 60 * 60 * 24))
          if (daysOverdue === null || diff > daysOverdue) {
            daysOverdue = diff
          }
        } else if (daysOverdue === null) {
          daysOverdue = 1 // Default to 1 day overdue if out of window but math doesn't align
        }
      }
    }

    const subjectId = String(sub.id)

    return {
      subjectId,
      subjectIdentifier: String(sub.subject_identifier),
      enrollmentStatus: sub.enrollment_status ? String(sub.enrollment_status) : 'Unknown',
      currentVisitName,
      nextVisitName,
      overdueVisitCount: overdueCount,
      activeAeCount: activeAeCountBySubject.get(subjectId) ?? 0,
      activeConMedCount: activeConMedCountBySubject.get(subjectId) ?? 0,
      lastActivityDate,
      hrefSubject: `/subjects/${subjectId}/workspace`
    }
  })
}

function countBySubject<T extends Record<string, unknown>>(rows: T[], subjectKey: keyof T) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const subjectId = String(row[subjectKey] ?? '')
    if (!subjectId) continue
    counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1)
  }
  return counts
}
