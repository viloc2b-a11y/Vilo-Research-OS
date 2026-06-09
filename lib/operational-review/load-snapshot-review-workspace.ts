import type { SupabaseClient } from '@supabase/supabase-js'
import { loadVisitSnapshotById } from '@/lib/visit-runtime-locking/load-visit-snapshot'
import { listSnapshotQueries } from './list-snapshot-queries'
import {
  mapVisitSnapshotQueryEventRow,
  mapVisitSnapshotReviewRow,
  REVIEW_TYPE,
  type LoadedSnapshotReviewWorkspace,
} from './operational-review-types'

export async function loadSnapshotReviewWorkspace(
  supabase: SupabaseClient,
  organizationId: string,
  snapshotId: string,
  searchQuery?: string | null,
): Promise<LoadedSnapshotReviewWorkspace | null> {
  const snapshot = await loadVisitSnapshotById(supabase, organizationId, snapshotId)
  if (!snapshot) return null

  const { data: reviewRow } = await supabase
    .from('visit_snapshot_reviews')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('organization_id', organizationId)
    .eq('review_type', REVIEW_TYPE.OPERATIONAL)
    .maybeSingle()

  const queries = await listSnapshotQueries(supabase, organizationId, snapshotId, searchQuery)

  const { data: eventRows, error: eventError } = await supabase
    .from('visit_snapshot_query_events')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('organization_id', organizationId)
    .order('event_timestamp', { ascending: true })

  if (eventError) throw new Error(eventError.message)

  return {
    snapshot,
    review: reviewRow ? mapVisitSnapshotReviewRow(reviewRow as Record<string, unknown>) : null,
    queries,
    events: (eventRows ?? []).map((row) =>
      mapVisitSnapshotQueryEventRow(row as Record<string, unknown>),
    ),
  }
}
