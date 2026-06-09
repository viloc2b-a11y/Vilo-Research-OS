import type {
  LabObservationValue,
  LabSignalKind,
  LongitudinalLabObservation,
  LongitudinalLabRuntime,
  LongitudinalLabSeries,
  LongitudinalLabSeriesPoint,
  LongitudinalLabSignal,
  LabTrendConfig,
  LabTrendState,
} from './types'
import { DEFAULT_LAB_TREND_CONFIG } from './types'

const LAB_META_KEYS = new Set([
  'collection_date',
  'collection_time',
  'collection_datetime',
  'lab_collection_datetime',
  'result_unit',
  'unit',
  'reference_low',
  'reference_high',
  'abnormal_flag',
  'lab_abnormal_flag',
  'lab_clinically_significant',
  'clinically_significant',
  'investigator_assessment',
  'lab_result_summary',
  'lab_panel',
  'lab_result',
  'result_summary',
])

const LAB_SUFFIXES = [
  '_reference_low',
  '_reference_high',
  '_abnormal_flag',
  '_clinically_significant',
  '_investigator_assessment',
  '_result_summary',
  '_result',
  '_value',
  '_unit',
  '_collection_datetime',
  '_collection_date',
  '_collection_time',
  '_summary',
  '_panel',
] as const

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}%`
}

function compareIso(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

function compareObservation(a: LongitudinalLabObservation, b: LongitudinalLabObservation): number {
  const byCollection = compareIso(a.collectionAt, b.collectionAt)
  if (byCollection !== 0) return byCollection
  const byCaptured = compareIso(a.capturedAt, b.capturedAt)
  if (byCaptured !== 0) return byCaptured
  return a.responseId.localeCompare(b.responseId)
}

function normalizeLabKey(fieldKey: string): string {
  const key = lower(fieldKey)
  for (const suffix of LAB_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length).replace(/_+$/, '') || key
    }
  }
  if (key.startsWith('lab_')) {
    return key.slice(4) || key
  }
  return key
}

function isMetaOnlyField(fieldKey: string): boolean {
  return LAB_META_KEYS.has(lower(fieldKey))
}

function responseValue(response: {
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: unknown
}): LabObservationValue {
  if (response.value_number != null) {
    return { kind: 'number', display: formatNumber(response.value_number), numeric: response.value_number, raw: response.value_number }
  }
  if (response.value_text != null && response.value_text.trim() !== '') {
    const display = response.value_text.trim()
    return {
      kind: 'text',
      display,
      numeric: asNumber(display),
      raw: display,
    }
  }
  if (response.value_boolean != null) {
    const display = response.value_boolean ? 'Yes' : 'No'
    return { kind: 'boolean', display, numeric: response.value_boolean ? 1 : 0, raw: response.value_boolean }
  }
  if (response.value_datetime != null) {
    return { kind: 'datetime', display: response.value_datetime, numeric: null, raw: response.value_datetime }
  }
  if (response.value_date != null) {
    return { kind: 'date', display: response.value_date, numeric: null, raw: response.value_date }
  }
  if (response.value_json != null) {
    return {
      kind: 'json',
      display: typeof response.value_json === 'string' ? response.value_json : JSON.stringify(response.value_json),
      numeric: null,
      raw: response.value_json,
    }
  }
  return { kind: 'empty', display: null, numeric: null, raw: null }
}

function inferCollectionAt(observation: LongitudinalLabObservation): string | null {
  if (observation.collectionAt) return observation.collectionAt
  return observation.capturedAt
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function formatTrendReason(input: {
  labName: string
  trendState: LabTrendState
  percentChangeBaseline: number | null
}): string {
  if (input.trendState === 'stable') {
    return `${input.labName} stayed within the stability threshold of baseline.`
  }
  if (input.trendState === 'fluctuating') {
    return `${input.labName} changed direction across visits and does not have a single stable trend yet.`
  }
  if (input.percentChangeBaseline === null) {
    return `${input.labName} moved away from baseline.`
  }
  const direction = input.percentChangeBaseline >= 0 ? 'increased' : 'decreased'
  return `${input.labName} ${direction} ${formatPercent(Math.abs(input.percentChangeBaseline))} from baseline.`
}

function computeTrendState(points: LongitudinalLabSeriesPoint[], config: LabTrendConfig): LabTrendState {
  if (points.length < 2) return 'stable'

  const numericPoints = points.filter((point) => point.value.numeric !== null)
  if (numericPoints.length < 2) {
    const last = points.at(-1)
    const prev = points.at(-2)
    if (!last || !prev) return 'stable'
    return last.value.display === prev.value.display ? 'stable' : 'fluctuating'
  }

  const first = numericPoints[0]
  const prev = numericPoints.at(-2) ?? numericPoints[0]
  const last = numericPoints.at(-1) ?? numericPoints[0]
  const baseline = first.value.numeric ?? 0
  const current = last.value.numeric ?? baseline
  const previous = prev.value.numeric ?? current
  const currentDistance = Math.abs(current - baseline)
  const previousDistance = Math.abs(previous - baseline)
  const currentDelta = current - previous
  const baselineDelta = current - baseline
  const prevBaselineDelta = previous - baseline
  const stableThreshold = config.stablePercentThreshold
  const significantThreshold = config.significantPercentThreshold
  const currentPercent =
    baseline === 0 ? Math.abs(currentDistance) * 100 : Math.abs((baselineDelta / baseline) * 100)
  const previousPercent =
    baseline === 0 ? Math.abs(previousDistance) * 100 : Math.abs((prevBaselineDelta / baseline) * 100)

  if (currentPercent <= stableThreshold || Math.abs(currentDistance - previousDistance) <= 1) {
    return 'stable'
  }

  if (currentDistance > previousDistance + significantThreshold && currentDelta !== 0) {
    return 'worsening'
  }

  if (currentDistance + significantThreshold < previousDistance) {
    return 'improving'
  }

  if (points.length >= 3) {
    const lastThree = numericPoints.slice(-3)
    if (lastThree.length === 3) {
      const distances = lastThree.map((point) => Math.abs((point.value.numeric ?? 0) - baseline))
      const monotoneUp = distances[0] < distances[1] && distances[1] < distances[2]
      const monotoneDown = distances[0] > distances[1] && distances[1] > distances[2]
      if (monotoneUp) return 'worsening'
      if (monotoneDown) return 'improving'
    }
  }

  if (currentPercent >= significantThreshold && previousPercent >= significantThreshold) {
    return 'fluctuating'
  }

  return 'fluctuating'
}

function countConsecutiveAbnormal(points: LongitudinalLabSeriesPoint[]): number {
  let count = 0
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (!points[i]) break
    if (!abnormalFromObservation(points[i])) break
    count += 1
  }
  return count
}

function countConsecutiveWorsening(
  points: LongitudinalLabSeriesPoint[],
  baseline: number | null,
): number {
  if (points.length < 2 || baseline === null) return 0
  const numericPoints = points.filter((point) => point.value.numeric !== null)
  if (numericPoints.length < 2) return 0

  let count = 1
  let previousDistance = Math.abs((numericPoints[0].value.numeric ?? baseline) - baseline)
  for (let i = 1; i < numericPoints.length; i += 1) {
    const current = numericPoints[i].value.numeric
    if (current === null) break
    const distance = Math.abs(current - baseline)
    if (distance <= previousDistance) {
      break
    }
    count += 1
    previousDistance = distance
  }
  return count
}

function abnormalFromObservation(observation: LongitudinalLabObservation): boolean {
  if (observation.abnormalFlag) {
    const flag = lower(observation.abnormalFlag)
    if (['normal', 'within_range', 'in_range', 'not_done'].includes(flag)) return false
    if (['high', 'low', 'critical', 'abnormal', 'elevated', 'decreased'].includes(flag)) return true
  }
  if (observation.clinicallySignificant === true) return true
  if (
    observation.value.numeric !== null &&
    observation.referenceLow !== null &&
    observation.value.numeric < observation.referenceLow
  ) {
    return true
  }
  if (
    observation.value.numeric !== null &&
    observation.referenceHigh !== null &&
    observation.value.numeric > observation.referenceHigh
  ) {
    return true
  }
  return false
}

function buildSignal(
  kind: LabSignalKind,
  severity: 'info' | 'warning' | 'critical',
  title: string,
  reason: string,
  input: {
    subjectId: string
    studyId: string
    visitId: string | null
    visitLabel: string
    seriesKey: string
    labName: string
    linkedObjectHref: string | null
    recommendedNextStep: string
  },
): LongitudinalLabSignal {
  return {
    kind,
    title,
    severity,
    reason,
    subjectId: input.subjectId,
    studyId: input.studyId,
    visitId: input.visitId,
    visitLabel: input.visitLabel,
    seriesKey: input.seriesKey,
    labName: input.labName,
    linkedObjectLabel: 'Lab result',
    linkedObjectHref: input.linkedObjectHref,
    recommendedNextStep: input.recommendedNextStep,
  }
}

export function deriveLongitudinalLabRuntime(
  observations: LongitudinalLabObservation[],
  config: Partial<LabTrendConfig> = {},
): LongitudinalLabRuntime {
  const runtimeConfig: LabTrendConfig = {
    ...DEFAULT_LAB_TREND_CONFIG,
    ...config,
  }
  const generatedAt = new Date().toISOString()
  const bySeries = new Map<string, LongitudinalLabObservation[]>()
  for (const observation of observations) {
    const list = bySeries.get(observation.seriesKey) ?? []
    list.push(observation)
    bySeries.set(observation.seriesKey, list)
  }

  const series: LongitudinalLabSeries[] = []
  const signals: LongitudinalLabSignal[] = []

  for (const [seriesKey, rawObservations] of bySeries.entries()) {
    const ordered = [...rawObservations].sort(compareObservation)
    const points: LongitudinalLabSeriesPoint[] = ordered.map((observation, index) => ({
      ...observation,
      order: index,
    }))

    const last = ordered.at(-1) ?? null
    if (!last) continue

    const baselinePoint = ordered[0] ?? null
    const previousPoint = ordered.at(-2) ?? baselinePoint
    const currentPoint = last

    const baselineNumber = baselinePoint?.value.numeric ?? null
    const previousNumber = previousPoint?.value.numeric ?? null
    const currentNumber = currentPoint.value.numeric ?? null

    const deltaPrevious =
      currentNumber !== null && previousNumber !== null ? currentNumber - previousNumber : null
    const deltaBaseline =
      currentNumber !== null && baselineNumber !== null ? currentNumber - baselineNumber : null
    const percentChangePrevious =
      deltaPrevious !== null && previousNumber !== 0 && previousNumber !== null
        ? (deltaPrevious / Math.abs(previousNumber)) * 100
        : null
    const percentChangeBaseline =
      deltaBaseline !== null && baselineNumber !== 0 && baselineNumber !== null
        ? (deltaBaseline / Math.abs(baselineNumber)) * 100
        : null

    const trendState = computeTrendState(points, runtimeConfig)
    const abnormalCount = countConsecutiveAbnormal(points)
    const latestAbnormal = abnormalFromObservation(currentPoint)
    const currentDate = inferCollectionAt(currentPoint)
    const baselineDate = baselinePoint ? inferCollectionAt(baselinePoint) : null
    const previousDate = previousPoint ? inferCollectionAt(previousPoint) : null
    const referenceRange =
      currentPoint.referenceLow !== null || currentPoint.referenceHigh !== null
        ? `${currentPoint.referenceLow ?? 'low'} - ${currentPoint.referenceHigh ?? 'high'}`
        : null

    const seriesRow: LongitudinalLabSeries = {
      seriesKey,
      labName: currentPoint.labName,
      labCategory: currentPoint.labCategory,
      visitId: currentPoint.visitId,
      visitLabel: currentPoint.visitLabel,
      visitCode: currentPoint.visitCode,
      collectionAt: currentPoint.collectionAt,
      currentDate,
      baselineDate,
      previousDate,
      baselineValue: baselinePoint ? baselinePoint.value.numeric ?? baselinePoint.value.display : null,
      previousValue: previousPoint ? previousPoint.value.numeric ?? previousPoint.value.display : null,
      currentValue: currentPoint.value.numeric ?? currentPoint.value.display,
      unit: currentPoint.unit,
      referenceLow: currentPoint.referenceLow,
      referenceHigh: currentPoint.referenceHigh,
      referenceRange,
      deltaPrevious,
      deltaBaseline,
      percentChangePrevious,
      percentChangeBaseline,
      trendState,
      trendReason: formatTrendReason({
        labName: currentPoint.labName,
        trendState,
        percentChangeBaseline,
      }),
      abnormalCount,
      latestAbnormal,
      observations: ordered,
    }

    series.push(seriesRow)

    const daysSinceCurrent = currentDate ? Math.max(0, Math.floor((Date.now() - parseDate(currentDate)!) / (24 * 60 * 60 * 1000))) : null
    const longGap = daysSinceCurrent !== null && daysSinceCurrent >= runtimeConfig.repeatGapDays
    const overdue = daysSinceCurrent !== null && daysSinceCurrent >= runtimeConfig.followUpOverdueDays
    const consecutiveWorsening = countConsecutiveWorsening(points, baselineNumber)

    if (trendState === 'worsening' && percentChangeBaseline !== null && Math.abs(percentChangeBaseline) >= runtimeConfig.significantPercentThreshold) {
      signals.push(
        buildSignal(
          'lab_worsening',
          'warning',
          `${currentPoint.labName} worsening`,
          `${currentPoint.labName} changed by ${formatPercent(percentChangeBaseline)} from baseline across ${ordered.length} visit(s).`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Review with investigator',
          },
        ),
      )
    }

    if (consecutiveWorsening >= 3) {
      signals.push(
        buildSignal(
          'lab_consecutive_worsening',
          'critical',
          `${currentPoint.labName} worsening over 3 visits`,
          `${currentPoint.labName} has worsened across ${consecutiveWorsening} consecutive observations.`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Review with investigator',
          },
        ),
      )
    }

    if (abnormalCount >= runtimeConfig.abnormalConsecutiveThreshold) {
      signals.push(
        buildSignal(
          'lab_consecutive_abnormal',
          'critical',
          `${currentPoint.labName} consecutive abnormal values`,
          `${currentPoint.labName} has ${abnormalCount} consecutive abnormal observations.`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Escalate for PI review',
          },
        ),
      )
    }

    if (latestAbnormal && longGap) {
      signals.push(
        buildSignal(
          'lab_missing_repeat',
          'warning',
          `${currentPoint.labName} missing repeat lab`,
          `${currentPoint.labName} has no repeat within ${runtimeConfig.repeatGapDays} days of the latest observation.`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Verify protocol-required follow-up',
          },
        ),
      )
    }

    if (latestAbnormal && overdue) {
      signals.push(
        buildSignal(
          'lab_follow_up_overdue',
          'critical',
          `${currentPoint.labName} follow-up overdue`,
          `${currentPoint.labName} remains abnormal and the latest collection is ${daysSinceCurrent} day(s) old.`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Verify protocol-required follow-up',
          },
        ),
      )
    }

    if (
      latestAbnormal ||
      (percentChangeBaseline !== null && Math.abs(percentChangeBaseline) >= runtimeConfig.safetyReviewPercentThreshold)
    ) {
      signals.push(
        buildSignal(
          'lab_safety_review',
          'critical',
          `${currentPoint.labName} safety review recommended`,
          `${currentPoint.labName} shows a material change or abnormal flag that warrants operational safety review.`,
          {
            subjectId: currentPoint.subjectId,
            studyId: currentPoint.studyId,
            visitId: currentPoint.visitId,
            visitLabel: currentPoint.visitLabel,
            seriesKey,
            labName: currentPoint.labName,
            linkedObjectHref: currentPoint.visitId ? `/visits/${currentPoint.visitId}` : null,
            recommendedNextStep: 'Escalate for PI review',
          },
        ),
      )
    }
  }

  const criticalSignalCount = signals.filter((signal) => signal.severity === 'critical').length

  return {
    subjectId: observations[0]?.subjectId ?? '',
    generatedAt,
    summary: {
      observedSeries: series.length,
      signalCount: signals.length,
      criticalSignalCount,
    },
    series: series.sort((a, b) => {
      const dateDelta = compareIso(a.currentDate, b.currentDate)
      if (dateDelta !== 0) return dateDelta
      return a.labName.localeCompare(b.labName)
    }),
    signals: signals.sort((a, b) => a.visitLabel.localeCompare(b.visitLabel) || a.title.localeCompare(b.title)),
  }
}

export function normalizeLabSeriesLabel(fieldLabel: string | null, fieldKey: string): string {
  const label = fieldLabel?.trim()
  if (label) return label
  return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function makeObservationValue(
  input: {
    value_text: string | null
    value_number: number | null
    value_boolean: boolean | null
    value_date: string | null
    value_datetime: string | null
    value_json: unknown
  },
): LabObservationValue {
  return responseValue(input)
}

export function isLabCandidateField(fieldKey: string, fieldLabel: string | null, sectionName: string | null, sourceType: string | null): boolean {
  const key = lower(fieldKey)
  const label = lower(fieldLabel)
  const section = lower(sectionName)
  const type = lower(sourceType)
  if (section.includes('lab') || type.includes('lab')) return true
  if (LAB_META_KEYS.has(key)) return true
  if (key.startsWith('lab_') || key.includes('_lab_')) return true
  if (key.endsWith('_value') || key.endsWith('_result') || key.endsWith('_summary') || key.endsWith('_panel')) return true
  if (['result', 'collection', 'abnormal', 'reference', 'specimen'].some((token) => key.includes(token))) return true
  return label.includes('lab') || label.includes('result') || label.includes('reference range')
}

export function deriveLabSeriesKey(fieldKey: string): string {
  return normalizeLabKey(fieldKey)
}

export function isLabMetaOnlyField(fieldKey: string): boolean {
  return isMetaOnlyField(fieldKey)
}
