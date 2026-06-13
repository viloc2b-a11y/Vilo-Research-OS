import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLabReportReviewRow,
  type LabReportReviewRow,
  type UpdateLabReportReviewInput,
} from './lab-report-review-types'

export async function updateLabReportReview(
  supabase: SupabaseClient,
  reviewId: string,
  organizationId: string,
  input: UpdateLabReportReviewInput,
): Promise<LabReportReviewRow> {
  const payload: Record<string, unknown> = {}

  if (input.reviewStatus !== undefined) {
    payload.review_status = input.reviewStatus
  }

  if (input.reviewedBy !== undefined) {
    payload.reviewed_by = input.reviewedBy
  }

  if (input.reviewedAt !== undefined) {
    payload.reviewed_at = input.reviewedAt
  }

  if (input.reviewNotes !== undefined) {
    payload.review_notes = input.reviewNotes
  }

  if (input.reviewScope !== undefined) {
    payload.review_scope = input.reviewScope
  }

  if (input.piClassification !== undefined) {
    payload.pi_classification = input.piClassification
  }

  if (input.piClassifiedBy !== undefined) {
    payload.pi_classified_by = input.piClassifiedBy
  }

  if (input.piClassifiedAt !== undefined) {
    payload.pi_classified_at = input.piClassifiedAt
  }

  if (input.signatureRequestId !== undefined) {
    payload.signature_request_id = input.signatureRequestId
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  const { data, error } = await supabase
    .from('lab_report_reviews')
    .update(payload)
    .eq('id', reviewId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update lab report review: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapLabReportReviewRow(data as Record<string, unknown>)
}
