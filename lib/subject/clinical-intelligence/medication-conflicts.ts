// lib/subject/clinical-intelligence/medication-conflicts.ts
// Phase 6D — ConMed temporal modeling utilities.
//
// Provides:
//   - buildMedicationWindows()     resolve SubjectConMed[] → MedicationWindow[]
//   - activeAtDate()               medications active at a specific date
//   - activeNow()                  medications active at call time
//   - findOverlappingPairs()       detect temporally overlapping medication windows
//   - windowsForDrugClass()        filter by drug class (substring match)
//
// Design: pure functions, no DB calls, no side effects.
// Protocol conflict hook stubs are typed but left for the engine layer.

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type { MedicationWindow, MedicationWindowOverlap } from './types'

// ---------------------------------------------------------------------------
// Canonical anticoagulant / antiplatelet identifier lists
//
// CLINICAL NOTE:
// This list intentionally includes P2Y12 antiplatelet agents (clopidogrel,
// ticagrelor, prasugrel) alongside classical anticoagulants. These agents are
// mechanistically distinct but are grouped here because they carry equivalent
// bleeding-risk signals relevant to most clinical trial exclusion screens.
// If a protocol distinguishes the two categories, use ANTICOAGULANT_DRUG_CLASSES
// / ANTICOAGULANT_MED_NAMES separately and filter accordingly.
// ---------------------------------------------------------------------------

/**
 * Drug-class substrings that indicate anticoagulant / antiplatelet therapy.
 * Matched case-insensitively via substring search against MedicationWindow.drugClass.
 */
export const ANTICOAGULANT_DRUG_CLASSES: readonly string[] = [
  'anticoagulant',
  'anticoagulation',
  'thrombin inhibitor',
  'factor xa inhibitor',
  'vitamin k antagonist',
]

/**
 * Common medication name substrings that indicate anticoagulant / antiplatelet therapy.
 * Matched case-insensitively via substring search against MedicationWindow.name.
 *
 * Includes P2Y12 antiplatelet agents — see CLINICAL NOTE above.
 */
export const ANTICOAGULANT_MED_NAMES: readonly string[] = [
  'warfarin',
  'heparin',
  'enoxaparin',
  'apixaban',
  'rivaroxaban',
  'dabigatran',
  'edoxaban',
  'fondaparinux',
  'tinzaparin',
  'dalteparin',
  'clopidogrel',
  'ticagrelor',
  'prasugrel',
]

// ---------------------------------------------------------------------------
// Build medication windows from the Phase 6C conmed array
// ---------------------------------------------------------------------------

/**
 * Resolve SubjectConMed[] into normalized MedicationWindow[].
 * The window represents the full temporal span of each medication.
 */
export function buildMedicationWindows(
  conmeds: SubjectClinicalProfile['conmeds'],
): MedicationWindow[] {
  return conmeds.map((c) => ({
    conmedId: c.conmed_id,
    name:
      c.medication_library?.medication_name ?? c.custom_medication_name ?? 'Unknown medication',
    drugClass: c.medication_library?.drug_class ?? null,
    startDate: c.start_date,
    stopDate: c.stop_date,
    ongoing: c.ongoing,
    status: c.status,
    prn: c.prn,
  }))
}

// ---------------------------------------------------------------------------
// Temporal selectors
// ---------------------------------------------------------------------------

/**
 * Parse ISO date string to a comparable numeric timestamp.
 * Returns -Infinity for null (treated as "beginning of time" for open-start).
 * Returns +Infinity for null stop dates on ongoing medications.
 */
function toTime(
  date: string | null,
  fallback: number,
): number {
  if (date === null) return fallback
  const t = Date.parse(date)
  return isNaN(t) ? fallback : t
}

/**
 * Returns true if the medication window was active on the given ISO date.
 *
 * A window is considered active on a date if:
 *   startDate <= targetDate AND (ongoing OR stopDate >= targetDate OR stopDate is null)
 *
 * If startDate is null (undocumented), the medication is assumed to have
 * been active before its capture date — include it conservatively.
 */
export function isWindowActiveAtDate(
  window: MedicationWindow,
  isoDate: string,
): boolean {
  const target = Date.parse(isoDate)
  if (isNaN(target)) return false

  const start = toTime(window.startDate, -Infinity)   // null → open start
  const stop = window.ongoing
    ? Infinity
    : toTime(window.stopDate, Infinity)               // null stop + not ongoing → unclear end; include conservatively

  return start <= target && target <= stop
}

/**
 * Returns medications from a window array that were active on a given ISO date.
 *
 * @param windows   MedicationWindow[] (from buildMedicationWindows)
 * @param isoDate   Target date in ISO format ('YYYY-MM-DD' or full ISO timestamp)
 */
export function activeAtDate(
  windows: MedicationWindow[],
  isoDate: string,
): MedicationWindow[] {
  return windows.filter((w) => isWindowActiveAtDate(w, isoDate))
}

/**
 * Returns medications currently active (as of calling time).
 * Uses status === 'active' as primary signal; falls back to temporal check.
 */
export function activeNow(windows: MedicationWindow[]): MedicationWindow[] {
  const now = new Date().toISOString()
  return windows.filter(
    (w) => w.status === 'active' || (w.status !== 'discontinued' && isWindowActiveAtDate(w, now)),
  )
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

/**
 * Returns true if two medication windows have any temporal overlap.
 *
 * Overlap condition:
 *   start_A <= stop_B AND start_B <= stop_A
 * (standard interval overlap — inclusive bounds)
 *
 * Windows with null start dates are treated as beginning at -Infinity (overlap likely).
 * Windows with null stop dates or ongoing=true are treated as ending at +Infinity.
 */
export function doWindowsOverlap(a: MedicationWindow, b: MedicationWindow): boolean {
  if (a.conmedId === b.conmedId) return false   // same record — skip

  const startA = toTime(a.startDate, -Infinity)
  const stopA = a.ongoing ? Infinity : toTime(a.stopDate, Infinity)
  const startB = toTime(b.startDate, -Infinity)
  const stopB = b.ongoing ? Infinity : toTime(b.stopDate, Infinity)

  return startA <= stopB && startB <= stopA
}

/**
 * Returns all pairs of MedicationWindows that overlap temporally.
 * Useful as input to a protocol conflict check.
 * O(n²) — intended for small arrays (< 50 medications per subject is typical).
 */
export function findOverlappingPairs(
  windows: MedicationWindow[],
): MedicationWindowOverlap[] {
  const overlaps: MedicationWindowOverlap[] = []

  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (doWindowsOverlap(windows[i], windows[j])) {
        overlaps.push({ a: windows[i], b: windows[j] })
      }
    }
  }

  return overlaps
}

/**
 * Filter windows by drug class (case-insensitive substring match).
 * Useful for targeting specific therapeutic classes in protocol hooks.
 *
 * @param windows     MedicationWindow[]
 * @param className   e.g. 'anticoagulant', 'NSAID', 'opioid'
 */
export function windowsForDrugClass(
  windows: MedicationWindow[],
  className: string,
): MedicationWindow[] {
  const term = className.toLowerCase()
  return windows.filter((w) => w.drugClass?.toLowerCase().includes(term) ?? false)
}

/**
 * Filter windows by medication name (case-insensitive substring match).
 * Useful for targeting specific named medications in protocol hooks.
 */
export function windowsForMedicationName(
  windows: MedicationWindow[],
  term: string,
): MedicationWindow[] {
  const lower = term.toLowerCase()
  return windows.filter((w) => w.name.toLowerCase().includes(lower))
}
