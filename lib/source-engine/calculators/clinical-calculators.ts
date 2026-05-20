/**
 * Pure clinical calculation functions — no field-embedded formulas.
 */

import type { FieldResponseValue } from '@/lib/source-engine/runtime/runtime-context'

function num(value: FieldResponseValue | undefined): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return Number((value as { value: number }).value)
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function calculateBmi(
  heightCm: FieldResponseValue | undefined,
  weightKg: FieldResponseValue | undefined,
): number | null {
  const h = num(heightCm)
  const w = num(weightKg)
  if (h == null || w == null || h <= 0) return null
  const heightM = h / 100
  return Number((w / (heightM * heightM)).toFixed(2))
}

export function calculatePackYears(
  packsPerDay: FieldResponseValue | undefined,
  yearsSmoked: FieldResponseValue | undefined,
): number | null {
  const p = num(packsPerDay)
  const y = num(yearsSmoked)
  if (p == null || y == null) return null
  return Number((p * y).toFixed(2))
}

export function calculatePlateletDropPercent(
  baseline: FieldResponseValue | undefined,
  current: FieldResponseValue | undefined,
): number | null {
  const b = num(baseline)
  const c = num(current)
  if (b == null || c == null || b === 0) return null
  return Number((((b - c) / b) * 100).toFixed(1))
}

export function calculateBloodPressureDisplay(
  systolic: FieldResponseValue | undefined,
  diastolic: FieldResponseValue | undefined,
): string | null {
  const s = num(systolic)
  const d = num(diastolic)
  if (s == null || d == null) return null
  return `${s}/${d}`
}

export type VisitWindowInput = {
  scheduledDate: string
  visitDate: string
  windowStartDay?: number
  windowEndDay?: number
  targetDay?: number
}

export function calculateVisitWindowStatus(
  input: VisitWindowInput,
): 'in_window' | 'out_of_window' | 'missed' {
  if (!input.visitDate) return 'missed'
  const scheduled = new Date(input.scheduledDate).getTime()
  const actual = new Date(input.visitDate).getTime()
  if (Number.isNaN(scheduled) || Number.isNaN(actual)) return 'missed'
  const diffDays = Math.round((actual - scheduled) / (1000 * 60 * 60 * 24))
  const start = input.windowStartDay ?? -3
  const end = input.windowEndDay ?? 3
  if (diffDays >= start && diffDays <= end) return 'in_window'
  return 'out_of_window'
}

export function calculatePkWindowStatus(
  minutesFromIpStart: FieldResponseValue | undefined,
  nominalMinutes: number,
  windowBefore = 15,
  windowAfter = 15,
): 'in_window' | 'out_of_window' {
  const actual = num(minutesFromIpStart)
  if (actual == null) return 'out_of_window'
  const delta = Math.abs(actual - nominalMinutes)
  return delta <= Math.max(windowBefore, windowAfter) ? 'in_window' : 'out_of_window'
}

/** Placeholder instrument scores — wired when questionnaire definitions are bound. */
export function placeholderInstrumentScore(
  inputs: Record<string, FieldResponseValue>,
): null {
  void inputs
  return null
}
