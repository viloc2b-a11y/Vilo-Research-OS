import type { SupabaseClient } from '@supabase/supabase-js'
import { createLabReportReview } from './create-lab-report-review'
import { LAB_REPORT_TYPE } from './lab-report-review-types'

export type LabReviewRoutingResult =
  | { status: 'review_created'; reviewId: string }
  | { status: 'skipped_not_lab_result' }
  | { status: 'skipped_missing_subject_or_study' }
  | { status: 'skipped_duplicate' }

export type RouteDocumentToLabReviewOptions = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string | null
  subjectId: string | null
  visitId: string | null
  complianceDocumentId: string
  documentClassification: string
}

export async function routeDocumentToLabReview(
  opts: RouteDocumentToLabReviewOptions,
): Promise<LabReviewRoutingResult> {
  if (opts.documentClassification !== 'lab_result') {
    return { status: 'skipped_not_lab_result' }
  }

  if (!opts.studyId || !opts.subjectId) {
    return { status: 'skipped_missing_subject_or_study' }
  }

  const { data: existing } = await opts.supabase
    .from('lab_report_reviews')
    .select('id')
    .eq('compliance_document_id', opts.complianceDocumentId)
    .maybeSingle()

  if (existing) {
    return { status: 'skipped_duplicate' }
  }

  const review = await createLabReportReview(opts.supabase, {
    organizationId: opts.organizationId,
    studyId: opts.studyId,
    subjectId: opts.subjectId,
    visitId: opts.visitId ?? null,
    complianceDocumentId: opts.complianceDocumentId,
    reportType: LAB_REPORT_TYPE.SCANNED,
  })

  return { status: 'review_created', reviewId: review.id }
}
