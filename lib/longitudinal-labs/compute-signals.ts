import {
  SIGNAL_KIND,
  SIGNAL_SEVERITY,
  type LabSignal,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'

const RAPID_CHANGE_PERCENT_THRESHOLD = 50

function formatValue(value: number | null): string {
  if (value == null) return 'N/A'
  return String(value)
}

function outOfRangeSignal(
  result: LongitudinalLabResultRow,
): LabSignal | null {
  if (result.resultValue == null || result.referenceLow == null && result.referenceHigh == null) {
    return null
  }

  const isLow = result.referenceLow != null && result.resultValue < result.referenceLow
  const isHigh = result.referenceHigh != null && result.resultValue > result.referenceHigh

  if (!isLow && !isHigh) return null

  const direction = isLow ? 'below' : 'above'
  const threshold = isLow ? result.referenceLow : result.referenceHigh

  return {
    kind: SIGNAL_KIND.OUT_OF_RANGE,
    severity: SIGNAL_SEVERITY.WARNING,
    subjectId: result.subjectId,
    studyId: result.studyId,
    labTestCode: result.labTestCode,
    labTestName: result.labTestName,
    resultId: result.id,
    message: `${result.labTestName} (${formatValue(result.resultValue)} ${result.resultUnit ?? ''}) is ${direction} reference range (${formatValue(threshold)}).`,
    detail: {
      resultValue: result.resultValue,
      referenceLow: result.referenceLow,
      referenceHigh: result.referenceHigh,
      direction,
    },
  }
}

function clinicallySignificantSignal(
  result: LongitudinalLabResultRow,
): LabSignal | null {
  if (!result.clinicallySignificantFlag) return null

  return {
    kind: SIGNAL_KIND.CLINICALLY_SIGNIFICANT,
    severity: SIGNAL_SEVERITY.CRITICAL,
    subjectId: result.subjectId,
    studyId: result.studyId,
    labTestCode: result.labTestCode,
    labTestName: result.labTestName,
    resultId: result.id,
    message: `${result.labTestName} flagged as clinically significant (${formatValue(result.resultValue)} ${result.resultUnit ?? ''}).`,
    detail: {
      resultValue: result.resultValue,
      resultUnit: result.resultUnit,
    },
  }
}

function trendUpSignal(
  latest: LongitudinalLabResultRow,
  previous: LongitudinalLabResultRow | null,
): LabSignal | null {
  if (!previous || latest.resultValue == null || previous.resultValue == null) return null
  if (latest.resultValue <= previous.resultValue) return null

  const delta = latest.resultValue - previous.resultValue
  const pctChange =
    previous.resultValue !== 0
      ? (delta / Math.abs(previous.resultValue)) * 100
      : delta * 100

  return {
    kind: SIGNAL_KIND.TREND_UP,
    severity: SIGNAL_SEVERITY.INFO,
    subjectId: latest.subjectId,
    studyId: latest.studyId,
    labTestCode: latest.labTestCode,
    labTestName: latest.labTestName,
    resultId: latest.id,
    message: `${latest.labTestName} increased from ${formatValue(previous.resultValue)} to ${formatValue(latest.resultValue)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%).`,
    detail: {
      previousValue: previous.resultValue,
      currentValue: latest.resultValue,
      delta,
      percentChange: pctChange,
    },
  }
}

function trendDownSignal(
  latest: LongitudinalLabResultRow,
  previous: LongitudinalLabResultRow | null,
): LabSignal | null {
  if (!previous || latest.resultValue == null || previous.resultValue == null) return null
  if (latest.resultValue >= previous.resultValue) return null

  const delta = previous.resultValue - latest.resultValue
  const pctChange =
    previous.resultValue !== 0
      ? (delta / Math.abs(previous.resultValue)) * 100
      : delta * 100

  return {
    kind: SIGNAL_KIND.TREND_DOWN,
    severity: SIGNAL_SEVERITY.INFO,
    subjectId: latest.subjectId,
    studyId: latest.studyId,
    labTestCode: latest.labTestCode,
    labTestName: latest.labTestName,
    resultId: latest.id,
    message: `${latest.labTestName} decreased from ${formatValue(previous.resultValue)} to ${formatValue(latest.resultValue)} (${pctChange >= 0 ? '-' : ''}${pctChange.toFixed(1)}%).`,
    detail: {
      previousValue: previous.resultValue,
      currentValue: latest.resultValue,
      delta,
      percentChange: pctChange,
    },
  }
}

function rapidChangeSignal(
  latest: LongitudinalLabResultRow,
  previous: LongitudinalLabResultRow | null,
): LabSignal | null {
  if (!previous || latest.resultValue == null || previous.resultValue == null) return null

  const delta = Math.abs(latest.resultValue - previous.resultValue)
  const pctChange =
    previous.resultValue !== 0
      ? (delta / Math.abs(previous.resultValue)) * 100
      : delta * 100

  if (pctChange < RAPID_CHANGE_PERCENT_THRESHOLD) return null

  return {
    kind: SIGNAL_KIND.RAPID_CHANGE,
    severity: SIGNAL_SEVERITY.WARNING,
    subjectId: latest.subjectId,
    studyId: latest.studyId,
    labTestCode: latest.labTestCode,
    labTestName: latest.labTestName,
    resultId: latest.id,
    message: `${latest.labTestName} changed by ${pctChange.toFixed(1)}% between consecutive observations (threshold: ${RAPID_CHANGE_PERCENT_THRESHOLD}%).`,
    detail: {
      previousValue: previous.resultValue,
      currentValue: latest.resultValue,
      delta,
      percentChange: pctChange,
      threshold: RAPID_CHANGE_PERCENT_THRESHOLD,
    },
  }
}

type ResultsByTest = Map<string, LongitudinalLabResultRow[]>

function groupByTest(results: LongitudinalLabResultRow[]): ResultsByTest {
  const grouped: ResultsByTest = new Map()
  for (const result of results) {
    const list = grouped.get(result.labTestCode) ?? []
    list.push(result)
    grouped.set(result.labTestCode, list)
  }
  return grouped
}

export function computeSignals(
  results: LongitudinalLabResultRow[],
): LabSignal[] {
  const signals: LabSignal[] = []
  const grouped = groupByTest(results)

  for (const [, testResults] of grouped) {
    const sorted = [...testResults].sort((a, b) => {
      const aDate = a.collectionDate ?? a.createdAt
      const bDate = b.collectionDate ?? b.createdAt
      return aDate.localeCompare(bDate)
    })

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i]
      const previous = i > 0 ? sorted[i - 1] : null

      const oos = outOfRangeSignal(current)
      if (oos) signals.push(oos)

      const cs = clinicallySignificantSignal(current)
      if (cs) signals.push(cs)

      const up = trendUpSignal(current, previous)
      if (up) signals.push(up)

      const down = trendDownSignal(current, previous)
      if (down) signals.push(down)

      const rapid = rapidChangeSignal(current, previous)
      if (rapid) signals.push(rapid)
    }
  }

  return signals
}
