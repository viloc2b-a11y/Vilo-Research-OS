import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { exactCount } from '@/lib/performance/read-layer/query/count-helpers'
import {
  REVIEW_STATUS_VALUES,
  RISK_VISITS_QUERY_LIMIT,
  SOURCE_STATUS_VALUES,
  VISIT_STATUS_VALUES,
} from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type VisitStatusCountRow = { visit_status: string; count: number }
export type SourceStatusCountRow = { source_status: string; count: number }
export type ReviewStatusCountRow = { review_status: string; count: number }
export type RiskVisitRow = Record<string, unknown>

export type VisitSnapshotAggregate = {
  totalVisits: number
  byVisitStatus: Record<string, number>
  bySourceStatus: Record<string, number>
  byReviewStatus: Record<string, number>
}

export type VisitSignals = {
  snapshot: VisitSnapshotAggregate
  snapshotErrors: { source: string; message: string }[]
  riskVisits: RawSignal<RiskVisitRow>
}

async function countByField(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  field: 'visit_status' | 'source_status' | 'review_status',
  values: readonly string[],
  errorSource: string,
): Promise<{ counts: Record<string, number>; errors: { source: string; message: string }[] }> {
  const counts: Record<string, number> = {}
  const errors: { source: string; message: string }[] = []

  const results = await Promise.all(
    values.map(async (value) => {
      const result = await exactCount(() =>
        client
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .in('organization_id', scope.organizationIds)
          .in('study_id', scope.studyIds)
          .eq(field, value),
      )
      return { value, result }
    }),
  )

  for (const { value, result } of results) {
    if (result.error) {
      errors.push({ source: `${errorSource}_${value}`, message: result.error })
    } else if (result.count > 0) {
      counts[value] = result.count
    }
  }

  return { counts, errors }
}

export async function loadVisitSnapshot(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<{ snapshot: VisitSnapshotAggregate; errors: { source: string; message: string }[] }> {
  const errors: { source: string; message: string }[] = []

  const totalResult = await exactCount(() =>
    client
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .in('study_id', scope.studyIds),
  )

  if (totalResult.error) {
    errors.push({ source: 'visits_total', message: totalResult.error })
  }

  const [visitStatus, sourceStatus, reviewStatus] = await Promise.all([
    countByField(client, scope, 'visit_status', VISIT_STATUS_VALUES, 'visits_status'),
    countByField(client, scope, 'source_status', SOURCE_STATUS_VALUES, 'visits_source'),
    countByField(client, scope, 'review_status', REVIEW_STATUS_VALUES, 'visits_review'),
  ])

  errors.push(...visitStatus.errors, ...sourceStatus.errors, ...reviewStatus.errors)

  return {
    snapshot: {
      totalVisits: totalResult.count,
      byVisitStatus: visitStatus.counts,
      bySourceStatus: sourceStatus.counts,
      byReviewStatus: reviewStatus.counts,
    },
    errors,
  }
}

export async function loadRiskVisits(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<RiskVisitRow>> {
  const { data, error } = await client
    .from('visits')
    .select(
      `
      id,
      study_id,
      study_subject_id,
      visit_status,
      window_status,
      scheduled_date,
      target_date,
      window_end,
      study_subjects(subject_identifier),
      studies(name),
      visit_definitions(label, code)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .or('visit_status.in.(missed,out_of_window),window_status.in.(outside_window,warning)')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(RISK_VISITS_QUERY_LIMIT)

  if (error) {
    return { source: 'risk_visits', rows: [], error: { source: 'risk_visits', message: error.message } }
  }

  return { source: 'risk_visits', rows: (data ?? []) as RiskVisitRow[], error: null }
}

export async function loadVisitSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<VisitSignals> {
  const { snapshot, errors } = await loadVisitSnapshot(client, scope)
  const riskVisits = await loadRiskVisits(client, scope)

  return {
    snapshot,
    snapshotErrors: errors,
    riskVisits,
  }
}
