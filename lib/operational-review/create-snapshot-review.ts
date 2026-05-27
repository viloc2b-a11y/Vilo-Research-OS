import type { SupabaseClient } from '@supabase/supabase-js'
import { assertLockedSnapshot } from './assert-locked-snapshot'
import {
  mapVisitSnapshotReviewRow,
  REVIEW_STATUS,
  REVIEW_TYPE,
  type CreateSnapshotReviewInput,
  type VisitSnapshotReviewRow,
} from './operational-review-types'

export type CreateSnapshotReviewArgs = {
  supabase: SupabaseClient
  input: CreateSnapshotReviewInput
  createdBy: string
}

export async function createSnapshotReview(
  args: CreateSnapshotReviewArgs,
): Promise<VisitSnapshotReviewRow> {
  const reviewType = args.input.review_type ?? REVIEW_TYPE.OPERATIONAL

  const snapshot = await assertLockedSnapshot(
    args.supabase,
    args.input.organization_id,
    args.input.study_id,
    args.input.subject_id,
    args.input.snapshot_id,
  )

  const now = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('visit_snapshot_reviews')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      subject_id: args.input.subject_id,
      snapshot_id: args.input.snapshot_id,
      visit_instance_id: snapshot.visitInstanceId,
      review_type: reviewType,
      review_status: REVIEW_STATUS.NOT_STARTED,
      reviewer_role: args.input.reviewer_role ?? null,
      reviewer_user_id: args.createdBy,
      metadata: {},
      created_by: args.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new Error(`A ${reviewType} review already exists for this snapshot.`)
    }
    throw new Error(`Failed to create snapshot review: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitSnapshotReviewRow(data as Record<string, unknown>)
}
