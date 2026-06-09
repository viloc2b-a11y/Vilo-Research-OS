export type LabTrendState = 'improving' | 'stable' | 'worsening' | 'fluctuating'

export type LabSignalKind =
  | 'lab_worsening'
  | 'lab_consecutive_worsening'
  | 'lab_consecutive_abnormal'
  | 'lab_missing_repeat'
  | 'lab_follow_up_overdue'
  | 'lab_safety_review'

export type LabSignalSeverity = 'info' | 'warning' | 'critical'

export type LabObservationValue = {
  kind: 'number' | 'text' | 'boolean' | 'date' | 'datetime' | 'json' | 'empty'
  display: string | null
  numeric: number | null
  raw: unknown
}

export type LongitudinalLabObservation = {
  subjectId: string
  studyId: string
  responseSetId: string
  responseId: string
  sourceFieldId: string
  sourceDefinitionVersionId: string | null
  visitId: string | null
  visitLabel: string
  visitCode: string | null
  collectionAt: string | null
  capturedAt: string
  seriesKey: string
  labName: string
  labCategory: string
  fieldKey: string
  fieldLabel: string
  sourceSectionId: string | null
  sourceSectionName: string | null
  sourceType: string | null
  value: LabObservationValue
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  abnormalFlag: string | null
  clinicallySignificant: boolean | null
  investigatorAssessment: string | null
  sourceStatus: string
}

export type LongitudinalLabSeriesPoint = LongitudinalLabObservation & {
  order: number
}

export type LongitudinalLabSignal = {
  kind: LabSignalKind
  title: string
  severity: LabSignalSeverity
  reason: string
  subjectId: string
  studyId: string
  visitId: string | null
  visitLabel: string
  seriesKey: string
  labName: string
  linkedObjectLabel: string
  linkedObjectHref: string | null
  recommendedNextStep: string
}

export type LongitudinalLabSeries = {
  seriesKey: string
  labName: string
  labCategory: string
  visitId: string | null
  visitLabel: string
  visitCode: string | null
  collectionAt: string | null
  currentDate: string | null
  baselineDate: string | null
  previousDate: string | null
  baselineValue: string | number | null
  previousValue: string | number | null
  currentValue: string | number | null
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  referenceRange: string | null
  deltaPrevious: number | null
  deltaBaseline: number | null
  percentChangePrevious: number | null
  percentChangeBaseline: number | null
  trendState: LabTrendState
  trendReason: string
  abnormalCount: number
  latestAbnormal: boolean
  observations: LongitudinalLabObservation[]
}

export type LongitudinalLabRuntime = {
  subjectId: string
  generatedAt: string
  summary: {
    observedSeries: number
    signalCount: number
    criticalSignalCount: number
  }
  series: LongitudinalLabSeries[]
  signals: LongitudinalLabSignal[]
}

export type LabTrendConfig = {
  stablePercentThreshold: number
  significantPercentThreshold: number
  repeatGapDays: number
  followUpOverdueDays: number
  abnormalConsecutiveThreshold: number
  safetyReviewPercentThreshold: number
}

export const DEFAULT_LAB_TREND_CONFIG: LabTrendConfig = {
  stablePercentThreshold: 10,
  significantPercentThreshold: 20,
  repeatGapDays: 14,
  followUpOverdueDays: 14,
  abnormalConsecutiveThreshold: 2,
  safetyReviewPercentThreshold: 50,
}

