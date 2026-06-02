import { createServerClient } from '@/lib/supabase/server'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

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
  organizationId: string
): Promise<StudySubjectRosterRow[]> {
  const supabase = await createServerClient()
  
  const { data: subjects, error } = await supabase
    .from('study_subjects')
    .select(`
      id,
      subject_identifier,
      enrollment_status,
      updated_at,
      subject_adverse_events ( id, lifecycle_status ),
      subject_concomitant_medications ( conmed_id, ongoing ),
      visits (
        id,
        scheduled_date,
        target_date,
        window_start,
        window_end,
        actual_date,
        visit_status,
        visit_definitions ( code, label )
      )
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('subject_identifier', { ascending: true })

  if (error || !subjects) return []

  const ref = todayIsoDate()

  return subjects.map((sub: any) => {
    let currentVisitName = null
    let nextVisitName = null
    let overdueCount = 0
    let daysOverdue: number | null = null
    let lastActivityDate = sub.updated_at ? sub.updated_at.split('T')[0] : null

    const visits = sub.visits || []
    
    // Sort visits chronologically
    visits.sort((a: any, b: any) => {
      const dateA = a.scheduled_date || a.target_date || '9999-12-31'
      const dateB = b.scheduled_date || b.target_date || '9999-12-31'
      return dateA.localeCompare(dateB)
    })

    for (const v of visits) {
      const refreshed = refreshVisitOperationalFields({
        visitStatus: v.visit_status,
        scheduledDate: v.scheduled_date,
        targetDate: v.target_date,
        windowStartDate: v.window_start,
        windowEndDate: v.window_end,
        actualDate: v.actual_date,
        completedAt: null,
        referenceDate: ref
      })

      const def = Array.isArray(v.visit_definitions) ? v.visit_definitions[0] : v.visit_definitions
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

    const aes = sub.subject_adverse_events || []
    const activeAeCount = aes.filter((ae: any) => ae.lifecycle_status === 'open').length

    const conmeds = sub.subject_concomitant_medications || []
    const activeConMedCount = conmeds.filter((cm: any) => cm.ongoing === true).length

    return {
      subjectId: sub.id,
      subjectIdentifier: sub.subject_identifier,
      enrollmentStatus: sub.enrollment_status || 'Unknown',
      currentVisitName,
      nextVisitName,
      overdueVisitCount: overdueCount,
      activeAeCount,
      activeConMedCount,
      lastActivityDate,
      hrefSubject: `/subjects/${sub.id}/workspace`
    }
  })
}
