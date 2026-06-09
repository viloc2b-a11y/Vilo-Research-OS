// lib/visits/loadStudyVisits.ts
// Loads all visits for a study, grouped by subject.
// Used by Study Workspace → Visits tab.
// Reuses existing DB schema — no new tables needed.

import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import { createServerClient } from '@/lib/supabase/server'

export type StudyVisitGroup = 'today' | 'in_progress' | 'upcoming' | 'overdue' | 'completed' | 'other'

export interface StudyVisitRow {
  visitId:            string
  studySubjectId:     string
  subjectIdentifier:  string
  visitName:          string
  visitCode:          string
  visitStatus:        string
  windowStatus:       string
  scheduledDate:      string | null
  targetDate:         string | null
  windowStart:        string | null
  windowEnd:          string | null
  group:              StudyVisitGroup
  pendingProcedures:  number
  completedProcedures: number
  totalProcedures:    number
  hrefVisit:          string
  hrefSubject:        string
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toGroup(
  visitStatus: string,
  scheduledDate: string | null,
  today: string,
): StudyVisitGroup {
  if (visitStatus === 'completed' || visitStatus === 'locked') return 'completed'
  if (visitStatus === 'in_progress' || visitStatus === 'checked_in') return 'in_progress'
  if (visitStatus === 'missed' || visitStatus === 'out_of_window') return 'overdue'
  if (scheduledDate === today) return 'today'
  if (scheduledDate && scheduledDate > today) return 'upcoming'
  if (scheduledDate && scheduledDate < today) return 'overdue'
  return 'other'
}

export async function loadStudyVisits(
  studyId: string,
  organizationId: string,
  limit = 200,
  searchQuery?: string | null,
): Promise<{
  rows: StudyVisitRow[]
  today: StudyVisitRow[]
  inProgress: StudyVisitRow[]
  upcoming: StudyVisitRow[]
  overdue: StudyVisitRow[]
  completed: StudyVisitRow[]
  other: StudyVisitRow[]
  error: string | null
}> {
  const empty = { rows: [], today: [], inProgress: [], upcoming: [], overdue: [], completed: [], other: [], error: null }

  const supabase = await createServerClient()
  const ref = todayIsoDate()

  const normalizedSearch = searchQuery?.trim() ?? ''
  const visitSelect = `
      id,
      study_subject_id,
      visit_definition_id,
      scheduled_date,
      target_date,
      window_start,
      window_end,
      actual_date,
      visit_status,
      window_status,
      study_subjects(subject_identifier),
      visit_definitions(code, label)
    `

  let visitsData: Array<Record<string, unknown>> = []
  let errorMessage: string | null = null

  if (!normalizedSearch) {
    const { data, error } = await supabase
      .from('visits')
      .select(visitSelect)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .not('visit_status', 'in', '("cancelled")')
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('target_date', { ascending: true, nullsFirst: false })
      .limit(limit)

    visitsData = (data ?? []) as Array<Record<string, unknown>>
    errorMessage = error?.message ?? null
  } else {
    const [subjectMatches, definitionMatches] = await Promise.all([
      supabase
        .from('study_subjects')
        .select('id')
        .eq('study_id', studyId)
        .eq('organization_id', organizationId)
        .ilike('subject_identifier', `%${normalizedSearch}%`)
        .order('subject_identifier', { ascending: true })
        .limit(limit),
      supabase
        .from('visit_definitions')
        .select('id')
        .eq('study_id', studyId)
        .eq('organization_id', organizationId)
        .or(`code.ilike.%${normalizedSearch}%,label.ilike.%${normalizedSearch}%`)
        .order('code', { ascending: true })
        .limit(limit),
    ])

    if (subjectMatches.error) return { ...empty, error: subjectMatches.error.message }
    if (definitionMatches.error) return { ...empty, error: definitionMatches.error.message }

    const subjectIds = (subjectMatches.data ?? []).map((row) => String(row.id))
    const visitDefinitionIds = (definitionMatches.data ?? []).map((row) => String(row.id))

    const queryBlocks = []

    if (subjectIds.length > 0) {
      queryBlocks.push(
        supabase
          .from('visits')
          .select(visitSelect)
          .eq('study_id', studyId)
          .eq('organization_id', organizationId)
          .not('visit_status', 'in', '("cancelled")')
          .in('study_subject_id', subjectIds)
          .order('scheduled_date', { ascending: true, nullsFirst: false })
          .order('target_date', { ascending: true, nullsFirst: false })
          .limit(limit),
      )
    }

    if (visitDefinitionIds.length > 0) {
      queryBlocks.push(
        supabase
          .from('visits')
          .select(visitSelect)
          .eq('study_id', studyId)
          .eq('organization_id', organizationId)
          .not('visit_status', 'in', '("cancelled")')
          .in('visit_definition_id', visitDefinitionIds)
          .order('scheduled_date', { ascending: true, nullsFirst: false })
          .order('target_date', { ascending: true, nullsFirst: false })
          .limit(limit),
      )
    }

    if (queryBlocks.length === 0) return empty

    const results = await Promise.all(queryBlocks)
    const errors = results.map((result) => result.error?.message).filter(Boolean)
    if (errors.length > 0) return { ...empty, error: errors[0] ?? 'Unable to load visits.' }

    const uniqueRows = new Map<string, Record<string, unknown>>()
    for (const result of results) {
      for (const row of result.data ?? []) {
        const visitId = String(row.id ?? '')
        if (!visitId || uniqueRows.has(visitId)) continue
        uniqueRows.set(visitId, row)
      }
    }

    visitsData = Array.from(uniqueRows.values()).sort((left, right) => {
      const leftScheduled = String(left.scheduled_date ?? '')
      const rightScheduled = String(right.scheduled_date ?? '')
      if (leftScheduled !== rightScheduled) {
        return leftScheduled.localeCompare(rightScheduled)
      }

      const leftTarget = String(left.target_date ?? '')
      const rightTarget = String(right.target_date ?? '')
      if (leftTarget !== rightTarget) {
        return leftTarget.localeCompare(rightTarget)
      }

      return String(left.id ?? '').localeCompare(String(right.id ?? ''))
    }).slice(0, limit)
  }

  if (errorMessage) return { ...empty, error: errorMessage }
  if (!visitsData.length) return empty

  // Batch-load procedure counts
  const visitIds = visitsData.map((v) => String(v.id))
  const { data: procData } = visitIds.length > 0
    ? await supabase
        .from('procedure_executions')
        .select('visit_id, execution_status')
        .in('visit_id', visitIds)
    : { data: [] as { visit_id: string; execution_status: string }[] }

  // Build procedure count maps
  const totalByVisit     = new Map<string, number>()
  const completedByVisit = new Map<string, number>()
  const pendingByVisit   = new Map<string, number>()

  for (const p of procData ?? []) {
    const vid = p.visit_id as string
    totalByVisit.set(vid, (totalByVisit.get(vid) ?? 0) + 1)
    if (p.execution_status === 'completed') {
      completedByVisit.set(vid, (completedByVisit.get(vid) ?? 0) + 1)
    } else {
      pendingByVisit.set(vid, (pendingByVisit.get(vid) ?? 0) + 1)
    }
  }

  const rows: StudyVisitRow[] = visitsData.map((visit) => {
    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const def     = one(visit.visit_definitions) as { code?: string; label?: string } | null
    const visitId  = String(visit.id)
    const subjectId = String(visit.study_subject_id)

    const refreshed = refreshVisitOperationalFields({
      visitStatus:    String(visit.visit_status),
      scheduledDate:  (visit.scheduled_date as string | null) ?? null,
      targetDate:     (visit.target_date as string | null) ?? null,
      windowStartDate:(visit.window_start as string | null) ?? null,
      windowEndDate:  (visit.window_end as string | null) ?? null,
      actualDate:     (visit.actual_date as string | null) ?? null,
      completedAt:    null,
      referenceDate:  ref,
    })

    const scheduledDate = (visit.scheduled_date as string | null) ?? null
    const group = toGroup(refreshed.visitStatus, scheduledDate, ref)

    return {
      visitId,
      studySubjectId:      subjectId,
      subjectIdentifier:   subject?.subject_identifier ?? '—',
      visitName:           def?.label ?? def?.code ?? 'Visit',
      visitCode:           def?.code ?? '—',
      visitStatus:         refreshed.visitStatus,
      windowStatus:        refreshed.windowStatus,
      scheduledDate,
      targetDate:          (visit.target_date as string | null) ?? null,
      windowStart:         (visit.window_start as string | null) ?? null,
      windowEnd:           (visit.window_end as string | null) ?? null,
      group,
      pendingProcedures:   pendingByVisit.get(visitId)   ?? 0,
      completedProcedures: completedByVisit.get(visitId) ?? 0,
      totalProcedures:     totalByVisit.get(visitId)     ?? 0,
      hrefVisit:    `/visits/${visitId}`,
      hrefSubject:  `/subjects/${subjectId}`,
    }
  })

  return {
    rows,
    today:      rows.filter(r => r.group === 'today'),
    inProgress: rows.filter(r => r.group === 'in_progress'),
    upcoming:   rows.filter(r => r.group === 'upcoming'),
    overdue:    rows.filter(r => r.group === 'overdue'),
    completed:  rows.filter(r => r.group === 'completed'),
    other:      rows.filter(r => r.group === 'other'),
    error:      null,
  }
}
