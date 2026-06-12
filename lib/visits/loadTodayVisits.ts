// lib/visits/loadTodayVisits.ts
// Loads visits scheduled for today across all orgs the coordinator belongs to.
// Used by the Operations Command Center homepage.

import { subjectChartPath, visitDetailPath } from '@/lib/ops/paths'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { createServerClient } from '@/lib/supabase/server'
import { filterDashboardTestDataRows } from '@/lib/dashboard-test-data'

export interface TodayVisitRow {
  visitId: string
  studySubjectId: string
  studyId: string
  subjectIdentifier: string
  visitName: string
  scheduledDate: string
  visitStatus: string
  hrefVisit: string
  hrefSubject: string
  pendingProcedures: number
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadTodayVisits(
  organizationIds: string[],
): Promise<TodayVisitRow[]> {
  if (organizationIds.length === 0) return []

  const supabase = await createServerClient()
  const today = todayIsoDate()

  const { data: rows, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      study_id,
      study_subject_id,
      scheduled_date,
      visit_status,
      studies(name, slug, created_source),
      study_subjects(subject_identifier),
      visit_definitions(code, label)
    `,
    )
    .in('organization_id', organizationIds)
    .eq('scheduled_date', today)
    .not('visit_status', 'in', '("cancelled","missed")')
    .order('scheduled_date', { ascending: true })
    .limit(20)

  if (error || !rows?.length) return []

  // Load pending procedure counts in one batch
  const visibleRows = filterDashboardTestDataRows(rows)
  const visitIds = visibleRows.map((r) => r.id as string)
  const { data: pendingProcs } = visitIds.length > 0
    ? await supabase
        .from('procedure_executions')
        .select('visit_id')
        .in('visit_id', visitIds)
        .in('execution_status', ['pending', 'in_progress'])
    : { data: [] as { visit_id: string }[] }

  const pendingByVisit = new Map<string, number>()
  for (const p of pendingProcs ?? []) {
    const vid = p.visit_id as string
    pendingByVisit.set(vid, (pendingByVisit.get(vid) ?? 0) + 1)
  }

  return visibleRows.map((visit) => {
    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const def = one(visit.visit_definitions) as { code?: string; label?: string } | null
    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string

    return {
      visitId,
      studySubjectId: subjectId,
      studyId,
      subjectIdentifier: subject?.subject_identifier ?? '—',
      visitName: def?.label ?? def?.code ?? 'Visit',
      scheduledDate: (visit.scheduled_date as string | null) ?? today,
      visitStatus: (visit.visit_status as string | null) ?? 'scheduled',
      hrefVisit: visitDetailPath(visitId),
      hrefSubject: subjectChartPath(studyId, subjectId),
      pendingProcedures: pendingByVisit.get(visitId) ?? 0,
    }
  })
}
