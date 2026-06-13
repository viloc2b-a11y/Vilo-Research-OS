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
  const sigEvidenceMap = new Map<string, {
    signedAt: string
    signerId: string
    signerName: string | null
    signerRole: string | null
    meaning: string
  }>()

  if (sigReqIds.length > 0) {
    const { data: sigReqs } = await supabase
      .from('operational_signature_requests')
      .select('id, status')
      .in('id', sigReqIds)

    for (const row of (sigReqs ?? []) as Record<string, unknown>[]) {
      sigStatusMap.set(String(row.id), String(row.status))
    }

    const signedReqIds = (sigReqs ?? [])
      .filter((r: Record<string, unknown>) => String(r.status) === 'signed')
      .map((r: Record<string, unknown>) => String(r.id))

    if (signedReqIds.length > 0) {
      const { data: sigs } = await supabase
        .from('operational_signatures')
        .select('request_id, signed_at, signer_user_id, signer_name_snapshot, signer_role_snapshot, signature_meaning')
        .in('request_id', signedReqIds)

      for (const s of (sigs ?? []) as Record<string, unknown>[]) {
        sigEvidenceMap.set(String(s.request_id), {
          signedAt: String(s.signed_at),
          signerId: String(s.signer_user_id),
          signerName: s.signer_name_snapshot ? String(s.signer_name_snapshot) : null,
          signerRole: s.signer_role_snapshot ? String(s.signer_role_snapshot) : null,
          meaning: String(s.signature_meaning),
        })
      }
    }
  }

  const reviewItems: LabReportReviewTimelineItem[] = reviews.map((r) => {
    const sigReqId = r.signatureRequestId
    const sigStatus = sigReqId ? sigStatusMap.get(sigReqId) ?? null : null
    const evidence = sigReqId && sigStatus === 'signed' ? sigEvidenceMap.get(sigReqId) ?? null : null

    return {
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
      signatureRequestId: sigReqId,
      signatureRequestStatus: sigStatus,
      signatureSignedAt: evidence?.signedAt ?? null,
      signatureSignerId: evidence?.signerId ?? null,
      signatureSignerName: evidence?.signerName ?? null,
      signatureSignerRole: evidence?.signerRole ?? null,
      signatureMeaning: evidence?.meaning ?? null,
      createdAt: r.createdAt,
    }
  })

  return { structuredTests: tests, reviewItems }
}
