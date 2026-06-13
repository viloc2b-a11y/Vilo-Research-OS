export const SIGNAL_KIND = {
  OUT_OF_RANGE: 'out_of_range',
  CLINICALLY_SIGNIFICANT: 'clinically_significant',
  TREND_UP: 'trend_up',
  TREND_DOWN: 'trend_down',
  RAPID_CHANGE: 'rapid_change',
} as const

export type SignalKind = (typeof SIGNAL_KIND)[keyof typeof SIGNAL_KIND]

export const SIGNAL_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const

export type SignalSeverity = (typeof SIGNAL_SEVERITY)[keyof typeof SIGNAL_SEVERITY]

export type LongitudinalLabResultRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
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
  sourceDocumentId: string | null
  labVendor: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type LongitudinalSubjectTimelineRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  labTestCode: string
  labTestName: string
  labCategory: string
  resultIds: string[]
  resultCount: number
  latestResultId: string | null
  baselineResultId: string | null
  baselineValue: number | null
  changeFromBaseline: number | null
  percentChangeFromBaseline: number | null
  lastSignalAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type InsertLabResultInput = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  collectionDate?: string | null
  resultDate?: string | null
  labTestCode: string
  labTestName: string
  labCategory?: string
  resultValue?: number | null
  resultUnit?: string | null
  referenceLow?: number | null
  referenceHigh?: number | null
  normalFlag?: boolean | null
  clinicallySignificantFlag?: boolean | null
  baselineFlag?: boolean
  sourceDocumentId?: string | null
  labVendor?: string | null
  metadata?: Record<string, unknown>
}

export type LabSignal = {
  kind: SignalKind
  severity: SignalSeverity
  subjectId: string
  studyId: string
  labTestCode: string
  labTestName: string
  resultId: string
  message: string
  detail: Record<string, unknown>
}

export type SubjectLabTimeline = {
  subjectId: string
  studyId: string
  tests: SubjectLabTestEntry[]
  generatedAt: string
}

export type SubjectLabTestEntry = {
  labTestCode: string
  labTestName: string
  labCategory: string
  baselineResult: LongitudinalLabResultRow | null
  latestResult: LongitudinalLabResultRow | null
  resultCount: number
  changeFromBaseline: number | null
  percentChangeFromBaseline: number | null
  signals: LabSignal[]
}

export function mapLongitudinalLabResultRow(row: Record<string, unknown>): LongitudinalLabResultRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitId: row.visit_id ? String(row.visit_id) : null,
    collectionDate: row.collection_date ? String(row.collection_date) : null,
    resultDate: row.result_date ? String(row.result_date) : null,
    labTestCode: String(row.lab_test_code),
    labTestName: String(row.lab_test_name),
    labCategory: String(row.lab_category ?? 'labs'),
    resultValue: row.result_value != null ? Number(row.result_value) : null,
    resultUnit: row.result_unit ? String(row.result_unit) : null,
    referenceLow: row.reference_low != null ? Number(row.reference_low) : null,
    referenceHigh: row.reference_high != null ? Number(row.reference_high) : null,
    normalFlag: row.normal_flag != null ? Boolean(row.normal_flag) : null,
    clinicallySignificantFlag: row.clinically_significant_flag != null ? Boolean(row.clinically_significant_flag) : null,
    baselineFlag: Boolean(row.baseline_flag),
    sourceDocumentId: row.source_document_id ? String(row.source_document_id) : null,
    labVendor: row.lab_vendor ? String(row.lab_vendor) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapSubjectTimelineRow(row: Record<string, unknown>): LongitudinalSubjectTimelineRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    labTestCode: String(row.lab_test_code),
    labTestName: String(row.lab_test_name),
    labCategory: String(row.lab_category ?? 'labs'),
    resultIds: (row.result_ids ?? []) as string[],
    resultCount: Number(row.result_count),
    latestResultId: row.latest_result_id ? String(row.latest_result_id) : null,
    baselineResultId: row.baseline_result_id ? String(row.baseline_result_id) : null,
    baselineValue: row.baseline_value != null ? Number(row.baseline_value) : null,
    changeFromBaseline: row.change_from_baseline != null ? Number(row.change_from_baseline) : null,
    percentChangeFromBaseline: row.percent_change_from_baseline != null ? Number(row.percent_change_from_baseline) : null,
    lastSignalAt: row.last_signal_at ? String(row.last_signal_at) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
