import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLongitudinalLabResultRow,
  type LabSignal,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'
import { computeSignals } from './compute-signals'

export type StudyLabFilterParams = {
  search?: string
  subjectId?: string
  visitId?: string
  labTestCode?: string
  labCategory?: string
  dateFrom?: string
  dateTo?: string
  signalKinds?: string[]
  reviewStatus?: string
  piClassification?: string
  reportType?: string
  limit?: number
  offset?: number
}

export type LabResultWithSignals = {
  resultType: 'structured_result'
  id: string
  subjectId: string
  subjectNumber: string | null
  visitId: string | null
  visitName: string | null
  collectionDate: string | null
  resultDate: string | null
  labTestCode: string
  labTestName: string
  labCategory: string
  resultValue: number | null
  resultUnit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  normalFlag: boolean | null
  clinicallySignificantFlag: boolean | null
  baselineFlag: boolean
  signals: LabSignal[]
}

export type LabReportReviewSearchItem = {
  resultType: 'lab_report_review'
  id: string
  subjectId: string
  subjectNumber: string | null
  visitId: string | null
  visitName: string | null
  documentFileName: string | null
  reviewStatus: string
  piClassification: string | null
  reportType: string
  reviewedBy: string | null
  reviewedAt: string | null
  signatureRequestId: string | null
  signatureRequestStatus: string | null
  signatureSignedAt: string | null
  signatureSignerName: string | null
  signatureMeaning: string | null
  createdAt: string
}

export type StudyLabSearchItem = LabResultWithSignals | LabReportReviewSearchItem

export type StudyLabResponse = {
  results: StudyLabSearchItem[]
  totalCount: number
  filterOptions: {
    labTests: string[]
    labCategories: string[]
    reviewStatuses: string[]
    piClassifications: string[]
    reportTypes: string[]
  }
}

export async function loadStudyLabResults(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  filters: StudyLabFilterParams = {},
): Promise<StudyLabResponse> {
  const limit = filters.limit ?? 500
  const offset = filters.offset ?? 0

  let query = supabase
    .from('longitudinal_lab_results')
    .select(
      `
      *,
      study_subjects(subject_identifier),
      visit_runtime_instances(visit_name)
    `,
      { count: 'exact' },
    )
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(
      `lab_test_name.ilike.${term},lab_test_code.ilike.${term}`,
    )
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.visitId) {
    query = query.eq('visit_id', filters.visitId)
  }

  if (filters.labTestCode) {
    query = query.eq('lab_test_code', filters.labTestCode)
  }

  if (filters.labCategory) {
    query = query.eq('lab_category', filters.labCategory)
  }

  if (filters.dateFrom) {
    query = query.gte('collection_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('collection_date', filters.dateTo)
  }

  const { data, error, count } = await query
    .order('collection_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to load study lab results: ${error.message}`)
  }

  const raw = (data ?? []) as Record<string, unknown>[]
  const results = raw.map(mapLongitudinalLabResultRow)
  const signalsById = computeSignalsForResults(results)

  const structuredResults: LabResultWithSignals[] = raw.map((row, idx) => {
    const result = results[idx]
    const subject = row.study_subjects as
      | { subject_identifier: string }
      | null
      | undefined
    const visit = row.visit_runtime_instances as
      | { visit_name: string }
      | null
      | undefined

    return {
      resultType: 'structured_result',
      id: result.id,
      subjectId: result.subjectId,
      subjectNumber: subject?.subject_identifier ?? null,
      visitId: result.visitId,
      visitName: visit?.visit_name ?? null,
      collectionDate: result.collectionDate,
      resultDate: result.resultDate,
      labTestCode: result.labTestCode,
      labTestName: result.labTestName,
      labCategory: result.labCategory,
      resultValue: result.resultValue,
      resultUnit: result.resultUnit,
      referenceLow: result.referenceLow,
      referenceHigh: result.referenceHigh,
      normalFlag: result.normalFlag,
      clinicallySignificantFlag: result.clinicallySignificantFlag,
      baselineFlag: result.baselineFlag,
      signals: signalsById.get(result.id) ?? [],
    }
  })

  let finalResults = structuredResults

  if (filters.signalKinds && filters.signalKinds.length > 0) {
    const kindSet = new Set(filters.signalKinds)
    finalResults = structuredResults.filter((r) =>
      r.signals.some((s) => kindSet.has(s.kind)),
    )
  }

  const { data: distinctTests } = await supabase
    .from('longitudinal_lab_results')
    .select('lab_test_code')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const labTests = [
    ...new Set(
      (distinctTests ?? []).map(
        (r: Record<string, unknown>) => r.lab_test_code as string,
      ),
    ),
  ].sort()

  const { data: distinctCategories } = await supabase
    .from('longitudinal_lab_results')
    .select('lab_category')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const labCategories = [
    ...new Set(
      (distinctCategories ?? []).map(
        (r: Record<string, unknown>) => r.lab_category as string,
      ),
    ),
  ].sort()

  let reviewQuery = supabase
    .from('lab_report_reviews')
    .select(
      `
      *,
      study_subjects!inner(subject_identifier),
      compliance_runtime_documents!inner(file_display_name),
      visit_runtime_instances(visit_name)
    `,
    )
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (filters.subjectId) {
    reviewQuery = reviewQuery.eq('subject_id', filters.subjectId)
  }

  if (filters.visitId) {
    reviewQuery = reviewQuery.eq('visit_id', filters.visitId)
  }

  if (filters.reviewStatus) {
    reviewQuery = reviewQuery.eq('review_status', filters.reviewStatus)
  }

  if (filters.piClassification) {
    reviewQuery = reviewQuery.eq('pi_classification', filters.piClassification)
  }

  if (filters.reportType) {
    reviewQuery = reviewQuery.eq('report_type', filters.reportType)
  }

  const { data: reviewData, error: reviewError } = await reviewQuery
    .order('created_at', { ascending: false, nullsFirst: false })

  if (reviewError) {
    throw new Error(
      `Failed to load lab report reviews: ${reviewError.message}`,
    )
  }

  const reviewItems: LabReportReviewSearchItem[] = (
    reviewData ?? []
  ).map((row) => {
    const r = row as Record<string, unknown>
    const subject = r.study_subjects as
      | { subject_identifier: string }
      | null
      | undefined
    const doc = r.compliance_runtime_documents as
      | { file_display_name: string | null }
      | null
      | undefined
    const visit = r.visit_runtime_instances as
      | { visit_name: string }
      | null
      | undefined

    return {
      resultType: 'lab_report_review',
      id: String(r.id),
      subjectId: String(r.subject_id),
      subjectNumber: subject?.subject_identifier ?? null,
      visitId: r.visit_id ? String(r.visit_id) : null,
      visitName: visit?.visit_name ?? null,
      documentFileName: doc?.file_display_name ?? null,
      reviewStatus: String(r.review_status),
      piClassification: r.pi_classification
        ? String(r.pi_classification)
        : null,
      reportType: String(r.report_type),
      reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
      reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
      signatureRequestId: r.signature_request_id
        ? String(r.signature_request_id)
        : null,
      signatureRequestStatus: null,
      signatureSignedAt: null,
      signatureSignerName: null,
      signatureMeaning: null,
      createdAt: String(r.created_at),
    }
  })

  const sigReqIds = reviewItems
    .map((r) => r.signatureRequestId)
    .filter((id): id is string => id !== null)

  if (sigReqIds.length > 0) {
    const { data: sigReqs } = await supabase
      .from('operational_signature_requests')
      .select('id, status')
      .in('id', sigReqIds)

    const sigStatusMap = new Map<string, string>()
    for (const sr of (sigReqs ?? []) as Record<string, unknown>[]) {
      sigStatusMap.set(String(sr.id), String(sr.status))
    }

    const signedReqIds = (sigReqs ?? [])
      .filter((r: Record<string, unknown>) => String(r.status) === 'signed')
      .map((r: Record<string, unknown>) => String(r.id))

    const sigEvidenceMap = new Map<string, {
      signedAt: string
      signerName: string | null
      meaning: string
    }>()

    if (signedReqIds.length > 0) {
      const { data: sigs } = await supabase
        .from('operational_signatures')
        .select('request_id, signed_at, signer_name_snapshot, signature_meaning')
        .in('request_id', signedReqIds)

      for (const s of (sigs ?? []) as Record<string, unknown>[]) {
        sigEvidenceMap.set(String(s.request_id), {
          signedAt: String(s.signed_at),
          signerName: s.signer_name_snapshot ? String(s.signer_name_snapshot) : null,
          meaning: String(s.signature_meaning),
        })
      }
    }

    for (const item of reviewItems) {
      if (!item.signatureRequestId) continue
      item.signatureRequestStatus = sigStatusMap.get(item.signatureRequestId) ?? null

      if (item.signatureRequestStatus === 'signed') {
        const ev = sigEvidenceMap.get(item.signatureRequestId)
        if (ev) {
          item.signatureSignedAt = ev.signedAt
          item.signatureSignerName = ev.signerName
          item.signatureMeaning = ev.meaning
        }
      }
    }
  }

  const { data: distinctStatuses } = await supabase
    .from('lab_report_reviews')
    .select('review_status')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const reviewStatuses = [
    ...new Set(
      (distinctStatuses ?? []).map(
        (r: Record<string, unknown>) => r.review_status as string,
      ),
    ),
  ].sort()

  const { data: distinctPiClasses } = await supabase
    .from('lab_report_reviews')
    .select('pi_classification')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const piClassifications = [
    ...new Set(
      (distinctPiClasses ?? [])
        .map((r: Record<string, unknown>) => r.pi_classification as string)
        .filter(Boolean),
    ),
  ].sort()

  const { data: distinctReportTypes } = await supabase
    .from('lab_report_reviews')
    .select('report_type')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const reportTypes = [
    ...new Set(
      (distinctReportTypes ?? []).map(
        (r: Record<string, unknown>) => r.report_type as string,
      ),
    ),
  ].sort()

  return {
    results: [
      ...finalResults,
      ...reviewItems,
    ],
    totalCount: (count ?? finalResults.length) + reviewItems.length,
    filterOptions: {
      labTests,
      labCategories,
      reviewStatuses,
      piClassifications,
      reportTypes,
    },
  }
}

function computeSignalsForResults(
  results: LongitudinalLabResultRow[],
): Map<string, LabSignal[]> {
  const grouped = new Map<string, LongitudinalLabResultRow[]>()

  for (const r of results) {
    const key = `${r.subjectId}:${r.labTestCode}`
    const list = grouped.get(key) ?? []
    list.push(r)
    grouped.set(key, list)
  }

  const signalsByResultId = new Map<string, LabSignal[]>()

  for (const [, group] of grouped) {
    const groupSignals = computeSignals(group)
    for (const signal of groupSignals) {
      const existing = signalsByResultId.get(signal.resultId) ?? []
      existing.push(signal)
      signalsByResultId.set(signal.resultId, existing)
    }
  }

  return signalsByResultId
}
