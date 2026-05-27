import type { SupabaseClient } from '@supabase/supabase-js'
import { appendQueryEvent } from './append-query-event'
import {
  mapVisitSnapshotQueryRow,
  mapVisitSnapshotReviewRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  REVIEW_STATUS,
  type VisitSnapshotReviewRow,
} from './operational-review-types'

export type StartSnapshotReviewArgs = {
  supabase: SupabaseClient
  organizationId: string
  reviewId: string
  actorId: string
  reviewerRole?: string | null
}

async function ensureReviewAnchorQuery(
  supabase: SupabaseClient,
  review: VisitSnapshotReviewRow,
  actorId: string,
) {
  const { data: reviewQueries } = await supabase
    .from('visit_snapshot_queries')
    .select('*')
    .eq('review_id', review.id)

  const existing = (reviewQueries ?? []).find(
    (row) => (row.metadata as { review_anchor?: boolean })?.review_anchor === true,
  )

  if (existing) {
    return mapVisitSnapshotQueryRow(existing as Record<string, unknown>)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('visit_snapshot_queries')
    .insert({
      organization_id: review.organizationId,
      study_id: review.studyId,
      subject_id: review.subjectId,
      snapshot_id: review.snapshotId,
      review_id: review.id,
      query_scope: 'visit',
      query_text: '[Review session anchor]',
      query_status: QUERY_STATUS.OPEN,
      priority: 'normal',
      assigned_role: 'crc',
      opened_by: actorId,
      opened_at: now,
      metadata: { review_anchor: true },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create review anchor query: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitSnapshotQueryRow(data as Record<string, unknown>)
}

export async function startSnapshotReview(
  args: StartSnapshotReviewArgs,
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

  if (review.reviewStatus === REVIEW_STATUS.IN_REVIEW || review.reviewStatus === REVIEW_STATUS.QUERIES_OPEN) {
    return review
  }
  if (review.reviewStatus !== REVIEW_STATUS.NOT_STARTED) {
    throw new Error(`Review cannot be started from status "${review.reviewStatus}".`)
  }

  const startedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('visit_snapshot_reviews')
    .update({
      review_status: REVIEW_STATUS.IN_REVIEW,
      reviewer_user_id: args.actorId,
      reviewer_role: args.reviewerRole ?? review.reviewerRole,
      started_at: startedAt,
      updated_at: startedAt,
    })
    .eq('id', args.reviewId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to start review: ${error?.message ?? 'Unknown error'}`)
  }

  const startedReview = mapVisitSnapshotReviewRow(data as Record<string, unknown>)
  const anchorQuery = await ensureReviewAnchorQuery(args.supabase, startedReview, args.actorId)

  await appendQueryEvent({
    supabase: args.supabase,
    query: anchorQuery,
    eventType: QUERY_EVENT_TYPE.REVIEW_STARTED,
    actorId: args.actorId,
    eventPayload: { review_id: startedReview.id },
  })

  return startedReview
}
