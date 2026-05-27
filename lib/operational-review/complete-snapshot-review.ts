import type { SupabaseClient } from '@supabase/supabase-js'
import { appendQueryEvent } from './append-query-event'
import { countUnresolvedQueries, loadSnapshotQuery } from './list-snapshot-queries'
import {
  mapVisitSnapshotQueryRow,
  mapVisitSnapshotReviewRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  REVIEW_STATUS,
  type VisitSnapshotReviewRow,
} from './operational-review-types'

export type CompleteSnapshotReviewArgs = {
  supabase: SupabaseClient
  organizationId: string
  reviewId: string
  actorId: string
  reviewNotes?: string | null
}

export async function completeSnapshotReview(
  args: CompleteSnapshotReviewArgs,
): Promise<VisitSnapshotReviewRow> {
  const { data: existing, error: loadError } = await args.supabase
    .from('visit_snapshot_reviews')
    .select('*')
    .eq('id', args.reviewId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Snapshot review not found.')

  const review = mapVisitSnapshotReviewRow(existing as Record<string, unknown>)

  if (review.reviewStatus === REVIEW_STATUS.COMPLETED) {
    return review
  }
  if (review.reviewStatus === REVIEW_STATUS.CANCELLED) {
    throw new Error('Cancelled reviews cannot be completed.')
  }
  if (review.reviewStatus === REVIEW_STATUS.NOT_STARTED) {
    throw new Error('Review must be started before it can be completed.')
  }

  const unresolved = await countUnresolvedQueries(
    args.supabase,
    args.organizationId,
    review.snapshotId,
    review.id,
  )
  if (unresolved > 0) {
    throw new Error(
      `Review cannot be completed while ${unresolved} unresolved quer${unresolved === 1 ? 'y' : 'ies'} remain.`,
    )
  }

  const { data: reviewQueries } = await args.supabase
    .from('visit_snapshot_queries')
    .select('*')
    .eq('review_id', review.id)

  const anchorRow = (reviewQueries ?? []).find(
    (row) => (row.metadata as { review_anchor?: boolean })?.review_anchor === true,
  )

  if (anchorRow && anchorRow.query_status !== QUERY_STATUS.RESOLVED) {
    const now = new Date().toISOString()
    await args.supabase
      .from('visit_snapshot_queries')
      .update({
        query_status: QUERY_STATUS.RESOLVED,
        resolution_text: 'Review session completed.',
        resolved_by: args.actorId,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', anchorRow.id)
  }

  const completedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('visit_snapshot_reviews')
    .update({
      review_status: REVIEW_STATUS.COMPLETED,
      completed_at: completedAt,
      completed_by: args.actorId,
      review_notes: args.reviewNotes?.trim() || review.reviewNotes,
      updated_at: completedAt,
    })
    .eq('id', args.reviewId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to complete review: ${error?.message ?? 'Unknown error'}`)
  }

  const completedReview = mapVisitSnapshotReviewRow(data as Record<string, unknown>)

  if (anchorRow) {
    const anchorQuery = await loadSnapshotQuery(args.supabase, args.organizationId, String(anchorRow.id))
    if (anchorQuery) {
      const resolvedAnchor = mapVisitSnapshotQueryRow({
        ...(anchorRow as Record<string, unknown>),
        query_status: QUERY_STATUS.RESOLVED,
      })
      await appendQueryEvent({
        supabase: args.supabase,
        query: resolvedAnchor,
        eventType: QUERY_EVENT_TYPE.REVIEW_COMPLETED,
        actorId: args.actorId,
        eventPayload: { review_id: completedReview.id },
      })
    }
  }

  return completedReview
}
