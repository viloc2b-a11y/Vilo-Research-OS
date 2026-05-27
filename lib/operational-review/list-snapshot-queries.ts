import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapVisitSnapshotQueryRow,
  UNRESOLVED_QUERY_STATUSES,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export async function listSnapshotQueries(
  supabase: SupabaseClient,
  organizationId: string,
  snapshotId: string,
): Promise<VisitSnapshotQueryRow[]> {
  const { data, error } = await supabase
    .from('visit_snapshot_queries')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('snapshot_id', snapshotId)
    .order('opened_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => mapVisitSnapshotQueryRow(row as Record<string, unknown>))
    .filter((query) => !query.metadata.review_anchor)
}

export function hasUnresolvedQueriesInList(queries: VisitSnapshotQueryRow[]): boolean {
  return queries.some(
    (query) =>
      UNRESOLVED_QUERY_STATUSES.includes(query.queryStatus) && !query.metadata.review_anchor,
  )
}

export async function countUnresolvedQueries(
  supabase: SupabaseClient,
  organizationId: string,
  snapshotId: string,
  reviewId?: string,
): Promise<number> {
  let query = supabase
    .from('visit_snapshot_queries')
    .select('id, query_status, metadata')
    .eq('organization_id', organizationId)
    .eq('snapshot_id', snapshotId)
    .in('query_status', UNRESOLVED_QUERY_STATUSES)

  if (reviewId) {
    query = query.eq('review_id', reviewId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).filter((row) => {
    const metadata = (row.metadata as { review_anchor?: boolean }) ?? {}
    return !metadata.review_anchor
  }).length
}

export async function loadSnapshotQuery(
  supabase: SupabaseClient,
  organizationId: string,
  queryId: string,
): Promise<VisitSnapshotQueryRow | null> {
  const { data, error } = await supabase
    .from('visit_snapshot_queries')
    .select('*')
    .eq('id', queryId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapVisitSnapshotQueryRow(data as Record<string, unknown>)
}
