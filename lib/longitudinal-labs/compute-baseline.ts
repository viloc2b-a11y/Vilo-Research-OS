import type { LongitudinalLabResultRow } from './longitudinal-lab-types'

export type BaselineResult = {
  baselineResultId: string
  baselineValue: number | null
  currentValue: number | null
  changeFromBaseline: number | null
  percentChangeFromBaseline: number | null
}

export function computeBaseline(
  results: LongitudinalLabResultRow[],
): BaselineResult | null {
  if (results.length === 0) return null

  const baseline = findBaselineResult(results)
  const latest = results[results.length - 1]

  if (!baseline) {
    return {
      baselineResultId: results[0].id,
      baselineValue: results[0].resultValue,
      currentValue: latest.resultValue,
      changeFromBaseline: null,
      percentChangeFromBaseline: null,
    }
  }

  const baselineValue = baseline.resultValue
  const currentValue = latest.resultValue
  const changeFromBaseline =
    baselineValue != null && currentValue != null
      ? currentValue - baselineValue
      : null

  const percentChangeFromBaseline =
    changeFromBaseline != null && baselineValue != null && baselineValue !== 0
      ? (changeFromBaseline / Math.abs(baselineValue)) * 100
      : null

  return {
    baselineResultId: baseline.id,
    baselineValue,
    currentValue,
    changeFromBaseline,
    percentChangeFromBaseline,
  }
}

export function computeChangeFromBaseline(
  currentValue: number | null,
  baselineValue: number | null,
): number | null {
  if (currentValue == null || baselineValue == null) return null
  return currentValue - baselineValue
}

export function computePercentChangeFromBaseline(
  currentValue: number | null,
  baselineValue: number | null,
): number | null {
  if (currentValue == null || baselineValue == null) return null
  if (baselineValue === 0) return null
  return ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100
}

function findBaselineResult(
  results: LongitudinalLabResultRow[],
): LongitudinalLabResultRow | null {
  const flagged = results.find((r) => r.baselineFlag)
  if (flagged) return flagged
  return results[0] ?? null
}
