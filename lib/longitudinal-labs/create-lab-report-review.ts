import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLabReportReviewRow,
  LAB_REPORT_REVIEW_SCOPE,
  type CreateLabReportReviewInput,
  type LabReportReviewRow,
} from './lab-report-review-types'

export async function createLabReportReview(
  supabase: SupabaseClient,
  input: CreateLabReportReviewInput,
): Promise<LabReportReviewRow> {
  const now = new Date().toISOString()
  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    subject_id: input.subjectId,
    visit_id: input.visitId ?? null,
    compliance_document_id: input.complianceDocumentId,
    longitudinal_result_id: input.longitudinalResultId ?? null,
    report_type: input.reportType,
    review_scope: input.reviewScope ?? LAB_REPORT_REVIEW_SCOPE.REPORT,
    lab_test_code: input.labTestCode ?? null,
    lab_test_name: input.labTestName ?? null,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('lab_report_reviews')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create lab report review: ${error?.message ?? 'Unknown error'}`,
    )
  }

  return mapLabReportReviewRow(data as Record<string, unknown>)
}
