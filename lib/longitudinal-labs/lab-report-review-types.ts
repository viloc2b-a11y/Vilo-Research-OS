export const LAB_REPORT_REVIEW_STATUS = {
  PENDING_REVIEW: 'pending_review',
  UNDER_REVIEW: 'under_review',
  REVIEWED: 'reviewed',
  REJECTED: 'rejected',
} as const

export type LabReportReviewStatus =
  (typeof LAB_REPORT_REVIEW_STATUS)[keyof typeof LAB_REPORT_REVIEW_STATUS]

export const LAB_REPORT_TYPE = {
  EXTRACTABLE: 'extractable',
  SCANNED: 'scanned',
} as const

export type LabReportType = (typeof LAB_REPORT_TYPE)[keyof typeof LAB_REPORT_TYPE]

export const LAB_REPORT_REVIEW_SCOPE = {
  REPORT: 'report',
  TEST: 'test',
} as const

export type LabReportReviewScope =
  (typeof LAB_REPORT_REVIEW_SCOPE)[keyof typeof LAB_REPORT_REVIEW_SCOPE]

export const LAB_REPORT_PI_CLASSIFICATION = {
  CS: 'cs',
  NCS: 'ncs',
  FOLLOW_UP_REQUIRED: 'follow_up_required',
} as const

export type LabReportPiClassification =
  (typeof LAB_REPORT_PI_CLASSIFICATION)[keyof typeof LAB_REPORT_PI_CLASSIFICATION]

export type LabReportReviewRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  complianceDocumentId: string
  longitudinalResultId: string | null
  reportType: LabReportType
  reviewScope: LabReportReviewScope
  labTestCode: string | null
  labTestName: string | null
  reviewStatus: LabReportReviewStatus
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  piClassification: LabReportPiClassification | null
  piClassifiedBy: string | null
  piClassifiedAt: string | null
  signatureRequestId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateLabReportReviewInput = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  complianceDocumentId: string
  longitudinalResultId?: string | null
  reportType: LabReportType
  reviewScope?: LabReportReviewScope
  labTestCode?: string | null
  labTestName?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateLabReportReviewInput = {
  reviewStatus?: LabReportReviewStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  reviewScope?: LabReportReviewScope
  piClassification?: LabReportPiClassification | null
  piClassifiedBy?: string | null
  piClassifiedAt?: string | null
  signatureRequestId?: string | null
  metadata?: Record<string, unknown>
}

export type LabReportReviewTimelineItem = {
  kind: 'lab_report_review'
  reviewId: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  visitName: string | null
  complianceDocumentId: string
  documentFileName: string | null
  reportType: LabReportType
  reviewStatus: LabReportReviewStatus
  piClassification: LabReportPiClassification | null
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  signatureRequestId: string | null
  signatureRequestStatus: string | null
  createdAt: string
}

export function mapLabReportReviewRow(row: Record<string, unknown>): LabReportReviewRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitId: row.visit_id ? String(row.visit_id) : null,
    complianceDocumentId: String(row.compliance_document_id),
    longitudinalResultId: row.longitudinal_result_id
      ? String(row.longitudinal_result_id)
      : null,
    reportType: String(row.report_type) as LabReportType,
    reviewScope: String(row.review_scope) as LabReportReviewScope,
    labTestCode: row.lab_test_code ? String(row.lab_test_code) : null,
    labTestName: row.lab_test_name ? String(row.lab_test_name) : null,
    reviewStatus: String(row.review_status) as LabReportReviewStatus,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewNotes: row.review_notes ? String(row.review_notes) : null,
    piClassification: row.pi_classification
      ? (String(row.pi_classification) as LabReportPiClassification)
      : null,
    piClassifiedBy: row.pi_classified_by ? String(row.pi_classified_by) : null,
    piClassifiedAt: row.pi_classified_at ? String(row.pi_classified_at) : null,
    signatureRequestId: row.signature_request_id
      ? String(row.signature_request_id)
      : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
