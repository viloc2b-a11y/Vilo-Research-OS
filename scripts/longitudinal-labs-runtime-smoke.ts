import assert from 'node:assert/strict'
import {
  deriveLongitudinalLabRuntime,
  makeObservationValue,
} from '@/lib/subject/lab-timeline/longitudinal-lab-runtime'
import type { LongitudinalLabObservation } from '@/lib/subject/lab-timeline/types'

function obs(input: {
  responseId: string
  seriesKey: string
  labName: string
  collectionAt: string
  value: number
  referenceLow: number
  referenceHigh: number
  visitLabel: string
}): LongitudinalLabObservation {
  return {
    subjectId: 'subject-smoke-1',
    studyId: 'study-smoke-1',
    responseSetId: `set-${input.seriesKey}`,
    responseId: input.responseId,
    sourceFieldId: `field-${input.seriesKey}`,
    sourceDefinitionVersionId: 'source-version-smoke',
    visitId: `visit-${input.visitLabel}`,
    visitLabel: input.visitLabel,
    visitCode: input.visitLabel.toUpperCase(),
    collectionAt: input.collectionAt,
    capturedAt: input.collectionAt,
    seriesKey: input.seriesKey,
    labName: input.labName,
    labCategory: 'labs',
    fieldKey: input.seriesKey,
    fieldLabel: input.labName,
    sourceSectionId: 'section-labs',
    sourceSectionName: 'Laboratory Results',
    sourceType: 'labs',
    value: makeObservationValue({
      value_text: null,
      value_number: input.value,
      value_boolean: null,
      value_date: null,
      value_datetime: null,
      value_json: null,
    }),
    unit: 'U/L',
    referenceLow: input.referenceLow,
    referenceHigh: input.referenceHigh,
    abnormalFlag:
      input.value > input.referenceHigh ? 'high' : input.value < input.referenceLow ? 'low' : 'normal',
    clinicallySignificant:
      input.value > input.referenceHigh || input.value < input.referenceLow,
    investigatorAssessment: null,
    sourceStatus: 'signed',
  }
}

const runtime = deriveLongitudinalLabRuntime([
  obs({
    responseId: 'alt-1',
    seriesKey: 'alt',
    labName: 'ALT',
    collectionAt: '2026-04-01T10:00:00.000Z',
    value: 28,
    referenceLow: 0,
    referenceHigh: 35,
    visitLabel: 'Screening',
  }),
  obs({
    responseId: 'alt-2',
    seriesKey: 'alt',
    labName: 'ALT',
    collectionAt: '2026-05-01T10:00:00.000Z',
    value: 35,
    referenceLow: 0,
    referenceHigh: 35,
    visitLabel: 'Visit 1',
  }),
  obs({
    responseId: 'alt-3',
    seriesKey: 'alt',
    labName: 'ALT',
    collectionAt: '2026-05-15T10:00:00.000Z',
    value: 74,
    referenceLow: 0,
    referenceHigh: 35,
    visitLabel: 'Visit 2',
  }),
  obs({
    responseId: 'hgb-1',
    seriesKey: 'hgb',
    labName: 'Hemoglobin',
    collectionAt: '2026-04-01T10:00:00.000Z',
    value: 11.8,
    referenceLow: 12,
    referenceHigh: 16,
    visitLabel: 'Screening',
  }),
  obs({
    responseId: 'hgb-2',
    seriesKey: 'hgb',
    labName: 'Hemoglobin',
    collectionAt: '2026-05-20T10:00:00.000Z',
    value: 10.8,
    referenceLow: 12,
    referenceHigh: 16,
    visitLabel: 'Visit 3',
  }),
  obs({
    responseId: 'hgb-3',
    seriesKey: 'hgb',
    labName: 'Hemoglobin',
    collectionAt: '2026-05-28T10:00:00.000Z',
    value: 9.8,
    referenceLow: 12,
    referenceHigh: 16,
    visitLabel: 'Visit 4',
  }),
])

assert.equal(runtime.summary.observedSeries, 2, 'expected 2 series')
const alt = runtime.series.find((series) => series.labName === 'ALT')
assert.ok(alt, 'ALT series should exist')
assert.equal(alt?.trendState, 'worsening', 'ALT should be worsening')
assert.ok(
  (alt?.percentChangeBaseline ?? 0) > 160,
  'ALT percent change should be materially above baseline',
)

const signalKinds = new Set(runtime.signals.map((signal) => signal.kind))
assert.ok(signalKinds.has('lab_worsening'), 'should emit lab_worsening')
assert.ok(signalKinds.has('lab_consecutive_worsening'), 'should emit lab_consecutive_worsening')
assert.ok(signalKinds.has('lab_consecutive_abnormal'), 'should emit lab_consecutive_abnormal')
assert.ok(signalKinds.has('lab_safety_review'), 'should emit lab_safety_review')

console.log(
  JSON.stringify(
    {
      ok: true,
      observedSeries: runtime.summary.observedSeries,
      signalCount: runtime.summary.signalCount,
      criticalSignalCount: runtime.summary.criticalSignalCount,
      altTrend: alt?.trendState,
      altReason: alt?.trendReason,
      signalKinds: [...signalKinds].sort(),
    },
    null,
    2,
  ),
)
