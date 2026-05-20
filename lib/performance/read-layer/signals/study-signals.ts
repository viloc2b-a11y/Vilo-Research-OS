import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { exactCount } from '@/lib/performance/read-layer/query/count-helpers'
import {
  ACTIVE_VISIT_STATUSES,
  MAX_STUDIES_FOR_CARD_COUNT_QUERIES,
  RISK_VISIT_STATUSES,
} from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type StudyRow = {
  id: string
  name: string
  status: string
}

export type StudyCountsRow = {
  studyId: string
  subjectCount: number
  activeVisitCount: number
  missedVisitCount: number
  openQueryCount: number
  blockedProcedureCount: number
}

export type StudySignals = {
  studies: RawSignal<StudyRow>
  studyCounts: RawSignal<StudyCountsRow>
}

export async function loadStudiesList(
  client: SupabaseServerClient,
  organizationIds: string[],
): Promise<RawSignal<StudyRow>> {
  const { data, error } = await client
    .from('studies')
    .select('id, name, status')
    .in('organization_id', organizationIds)
    .order('name', { ascending: true })

  if (error) {
    return { source: 'studies', rows: [], error: { source: 'studies', message: error.message } }
  }

  return { source: 'studies', rows: (data ?? []) as StudyRow[], error: null }
}

async function countSubjectsForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
) {
  return exactCount(() =>
    client
      .from('study_subjects')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId),
  )
}

async function countVisitsForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
  visitStatuses?: readonly string[],
) {
  return exactCount(() => {
    let query = client
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)

    if (visitStatuses?.length) {
      query = query.in('visit_status', [...visitStatuses])
    }

    return query
  })
}

async function countOpenQueriesForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
) {
  return exactCount(() =>
    client
      .from('subject_workflow_actions')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('action_type', 'query')
      .in('status', ['open', 'in_progress']),
  )
}

async function countBlockedProceduresForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
) {
  return exactCount(() =>
    client
      .from('procedure_executions')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('validation_status', 'blocked'),
  )
}

export async function loadStudyCardCounts(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyIds: string[],
): Promise<{
  counts: StudyCountsRow[]
  errors: { source: string; message: string }[]
  skipped: boolean
}> {
  const errors: { source: string; message: string }[] = []

  if (studyIds.length > MAX_STUDIES_FOR_CARD_COUNT_QUERIES) {
    return {
      counts: studyIds.map((studyId) => ({
        studyId,
        subjectCount: 0,
        activeVisitCount: 0,
        missedVisitCount: 0,
        openQueryCount: 0,
        blockedProcedureCount: 0,
      })),
      errors: [
        {
          source: 'study_card_counts',
          message: `Study list exceeds ${MAX_STUDIES_FOR_CARD_COUNT_QUERIES} studies; apply a study filter for per-study metrics.`,
        },
      ],
      skipped: true,
    }
  }

  const rows = await Promise.all(
    studyIds.map(async (studyId) => {
      const [subjects, active, missed, queries, blocked] = await Promise.all([
        countSubjectsForStudy(client, scope, studyId),
        countVisitsForStudy(client, scope, studyId, ACTIVE_VISIT_STATUSES),
        countVisitsForStudy(client, scope, studyId, RISK_VISIT_STATUSES),
        countOpenQueriesForStudy(client, scope, studyId),
        countBlockedProceduresForStudy(client, scope, studyId),
      ])

      for (const [source, result] of [
        ['study_subjects', subjects],
        ['visits_active', active],
        ['visits_missed', missed],
        ['workflow_queries', queries],
        ['procedures_blocked', blocked],
      ] as const) {
        if (result.error) {
          errors.push({ source: `${source}:${studyId}`, message: result.error })
        }
      }

      return {
        studyId,
        subjectCount: subjects.count,
        activeVisitCount: active.count,
        missedVisitCount: missed.count,
        openQueryCount: queries.count,
        blockedProcedureCount: blocked.count,
      }
    }),
  )

  return { counts: rows, errors, skipped: false }
}

export async function loadStudySignals(
  client: SupabaseServerClient,
  organizationIds: string[],
  queryScope: PerformanceQueryScope,
  studyIds: string[],
): Promise<StudySignals & { studyCountErrors: { source: string; message: string }[] }> {
  const studies = await loadStudiesList(client, organizationIds)
  const { counts, errors } = await loadStudyCardCounts(client, queryScope, studyIds)

  return {
    studies,
    studyCounts: { source: 'study_card_counts', rows: counts, error: null },
    studyCountErrors: errors,
  }
}
