import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSubjectTimelines } from './load-subject-timelines'
import { loadLabResults } from './load-lab-results'
import { computeBaseline } from './compute-baseline'
import { computeSignals } from './compute-signals'
import { loadLabReportReviews } from './load-lab-report-review'
import type { SubjectLabTestEntry } from './longitudinal-lab-types'
import type { LabReportReviewTimelineItem } from './lab-report-review-types'

export type SubjectLabsData = {
  structuredTests: SubjectLabTestEntry[]
  reviewItems: LabReportReviewTimelineItem[]
}

export async function buildSubjectLabTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  subjectId: string,
): Promise<SubjectLabsData> {
  const timelineRows = await loadSubjectTimelines(
    supabase,
    organizationId,
    subjectId,
  )

  const tests: SubjectLabTestEntry[] = []

  for (const row of timelineRows) {
    const results = await loadLabResults(
      supabase,
      organizationId,
      subjectId,
      row.labTestCode,
    )

    const baseline = computeBaseline(results)
    const computedSignals = computeSignals(results)

    tests.push({
      labTestCode: row.labTestCode,
      labTestName: row.labTestName,
      labCategory: row.labCategory,
      baselineResult: results.find((r) => r.id === row.baselineResultId) ?? null,
      latestResult: results.find((r) => r.id === row.latestResultId) ?? null,
      resultCount: row.resultCount,
      changeFromBaseline: baseline?.changeFromBaseline ?? null,
      percentChangeFromBaseline: baseline?.percentChangeFromBaseline ?? null,
      signals: computedSignals.filter((s) => s.labTestCode === row.labTestCode),
    })
  }

  const reviews = await loadLabReportReviews(supabase, {
    subjectId,
    organizationId,
  })

  const docIds = [...new Set(reviews.map((r) => r.complianceDocumentId))]
  const docMap = new Map<string, string | null>()

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('compliance_runtime_documents')
      .select('id, file_display_name')
      .in('id', docIds)

    for (const d of (docs ?? []) as Record<string, unknown>[]) {
      docMap.set(String(d.id), (d.file_display_name as string) ?? null)
    }
  }

  const sigReqIds = reviews
    .map((r) => r.signatureRequestId)
    .filter((id): id is string => id !== null)

  const sigStatusMap = new Map<string, string>()

  if (sigReqIds.length > 0) {
    const { data: sigReqs } = await supabase
      .from('operational_signature_requests')
      .select('id, status')
      .in('id', sigReqIds)

    for (const row of (sigReqs ?? []) as Record<string, unknown>[]) {
      sigStatusMap.set(String(row.id), String(row.status))
    }
  }

  const reviewItems: LabReportReviewTimelineItem[] = reviews.map((r) => ({
    kind: 'lab_report_review',
    reviewId: r.id,
    organizationId: r.organizationId,
    studyId: r.studyId,
    subjectId: r.subjectId,
    visitId: r.visitId,
    visitName: null,
    complianceDocumentId: r.complianceDocumentId,
    documentFileName: docMap.get(r.complianceDocumentId) ?? null,
    reportType: r.reportType,
    reviewStatus: r.reviewStatus,
    piClassification: r.piClassification,
    reviewNotes: r.reviewNotes,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    signatureRequestId: r.signatureRequestId,
    signatureRequestStatus: r.signatureRequestId
      ? sigStatusMap.get(r.signatureRequestId) ?? null
      : null,
    createdAt: r.createdAt,
  }))

  return { structuredTests: tests, reviewItems }
}
