import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLabReportReviewRow,
  type LabReportReviewRow,
  type LabReportReviewStatus,
  type LabReportType,
  type LabReportPiClassification,
} from './lab-report-review-types'

export type LoadLabReportReviewFilters = {
  reviewId?: string
  complianceDocumentId?: string
  subjectId?: string
  studyId?: string
  organizationId?: string
  reviewStatus?: LabReportReviewStatus
  piClassification?: LabReportPiClassification
  reportType?: LabReportType
  includeDocument?: boolean
}

export type LabReportReviewWithDocument = LabReportReviewRow & {
  documentFileName: string | null
  documentClassification: string | null
}

export async function loadLabReportReview(
  supabase: SupabaseClient,
  reviewId: string,
  organizationId: string,
): Promise<LabReportReviewRow | null> {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select('*')
    .eq('id', reviewId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapLabReportReviewRow(data as Record<string, unknown>) : null
}

export async function loadLabReportReviews(
  supabase: SupabaseClient,
  filters: LoadLabReportReviewFilters,
): Promise<LabReportReviewRow[]> {
  let query = supabase.from('lab_report_reviews').select('*')

  if (filters.reviewId) {
    query = query.eq('id', filters.reviewId)
  }

  if (filters.complianceDocumentId) {
    query = query.eq('compliance_document_id', filters.complianceDocumentId)
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.studyId) {
    query = query.eq('study_id', filters.studyId)
  }

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId)
  }

  if (filters.reviewStatus) {
    query = query.eq('review_status', filters.reviewStatus)
  }

  if (filters.piClassification) {
    query = query.eq('pi_classification', filters.piClassification)
  }

  if (filters.reportType) {
    query = query.eq('report_type', filters.reportType)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapLabReportReviewRow(row as Record<string, unknown>),
  )
}

export async function loadLabReportReviewWithDocument(
  supabase: SupabaseClient,
  reviewId: string,
  organizationId: string,
): Promise<LabReportReviewWithDocument | null> {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select(
      `
      *,
      compliance_runtime_documents!inner(
        file_display_name,
        document_classification
      )
    `,
    )
    .eq('id', reviewId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const raw = data as Record<string, unknown>
  const review = mapLabReportReviewRow(raw)
  const doc = raw.compliance_runtime_documents as
    | { file_display_name: string | null; document_classification: string | null }
    | null

  return {
    ...review,
    documentFileName: doc?.file_display_name ?? null,
    documentClassification: doc?.document_classification ?? null,
  }
}
