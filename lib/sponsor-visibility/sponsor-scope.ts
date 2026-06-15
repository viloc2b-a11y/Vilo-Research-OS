import type { SupabaseClient } from '@supabase/supabase-js'

export type SponsorStudyAccess = {
  studyId: string
  studyName: string
  status: string
  sponsorVisibility: 'full' | 'aggregate_only' | 'none'
}

export type SponsorStudySummary = {
  studyId: string
  studyName: string
  status: string
  subjectCount: number
  enrolledCount: number
  screenFailedCount: number
  completedCount: number
  activeVisitCount: number
  missedVisitCount: number
  openDeviationCount: number
  openSafetyEventCount: number
  leakageItemCount: number
  enrollmentTarget: number | null
  enrollmentEndDate: string | null
  lastActivityAt: string | null
}

export async function loadSponsorStudySummaries(
  supabase: SupabaseClient,
  organizationId: string,
  studyIds: string[],
): Promise<SponsorStudySummary[]> {
  if (studyIds.length === 0) return []

  const [studiesResult, subjectCountsResult, visitCountsResult, deviationCountsResult] =
    await Promise.all([
      supabase
        .from('studies')
        .select('id, name, status, enrollment_target, enrollment_end_date, updated_at')
        .eq('organization_id', organizationId)
        .in('id', studyIds),

      supabase
        .from('study_subjects')
        .select('study_id, enrollment_status')
        .eq('organization_id', organizationId)
        .in('study_id', studyIds),

      supabase
        .from('visits')
        .select('study_id, visit_status')
        .in('study_id', studyIds),

      supabase
        .from('protocol_deviations')
        .select('study_id, status')
        .eq('organization_id', organizationId)
        .in('study_id', studyIds)
        .not('status', 'in', '(resolved,closed)'),
    ])

  const studyMeta = new Map(
    (studiesResult.data ?? []).map((s) => [String(s.id), s]),
  )

  const subjectCountsByStudy = new Map<string, { total: number; enrolled: number; screenFailed: number; completed: number }>()
  for (const row of subjectCountsResult.data ?? []) {
    const sid = String(row.study_id)
    const current = subjectCountsByStudy.get(sid) ?? { total: 0, enrolled: 0, screenFailed: 0, completed: 0 }
    current.total++
    if (row.enrollment_status === 'enrolled') current.enrolled++
    if (row.enrollment_status === 'screen_failed') current.screenFailed++
    if (row.enrollment_status === 'completed') current.completed++
    subjectCountsByStudy.set(sid, current)
  }

  const visitCountsByStudy = new Map<string, { active: number; missed: number }>()
  for (const row of visitCountsResult.data ?? []) {
    const sid = String(row.study_id)
    const current = visitCountsByStudy.get(sid) ?? { active: 0, missed: 0 }
    if (row.visit_status === 'active' || row.visit_status === 'scheduled') current.active++
    if (row.visit_status === 'missed') current.missed++
    visitCountsByStudy.set(sid, current)
  }

  const deviationCountsByStudy = new Map<string, number>()
  for (const row of deviationCountsResult.data ?? []) {
    const sid = String(row.study_id)
    deviationCountsByStudy.set(sid, (deviationCountsByStudy.get(sid) ?? 0) + 1)
  }

  return studyIds.flatMap((studyId) => {
    const meta = studyMeta.get(studyId)
    if (!meta) return []
    const subjects = subjectCountsByStudy.get(studyId) ?? { total: 0, enrolled: 0, screenFailed: 0, completed: 0 }
    const visits = visitCountsByStudy.get(studyId) ?? { active: 0, missed: 0 }

    return [{
      studyId,
      studyName: String(meta.name),
      status: String(meta.status ?? 'unknown'),
      subjectCount: subjects.total,
      enrolledCount: subjects.enrolled,
      screenFailedCount: subjects.screenFailed,
      completedCount: subjects.completed,
      activeVisitCount: visits.active,
      missedVisitCount: visits.missed,
      openDeviationCount: deviationCountsByStudy.get(studyId) ?? 0,
      openSafetyEventCount: 0,
      leakageItemCount: 0,
      enrollmentTarget: meta.enrollment_target != null ? Number(meta.enrollment_target) : null,
      enrollmentEndDate: meta.enrollment_end_date ? String(meta.enrollment_end_date) : null,
      lastActivityAt: meta.updated_at ? String(meta.updated_at) : null,
    }]
  })
}
