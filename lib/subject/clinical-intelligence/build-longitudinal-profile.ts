// lib/subject/clinical-intelligence/build-longitudinal-profile.ts
// Phase 6D — Main aggregator: SubjectClinicalProfile → LongitudinalClinicalProfile.
//
// This is the single public entry point for Phase 6D consumers.
// It calls timeline, risk-flags, and medication-conflicts modules in sequence.
//
// Design constraints:
//   - Pure function: accepts an in-memory Phase 6C profile, no DB calls.
//   - Composable: timeline, risk-flags, medication-windows are independently usable.
//   - Lean: no joins, no background jobs, no caching at this layer
//     (consumers should cache at the server-component or request level).
//   - Safe for server components, server actions, and background utilities.

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type { LongitudinalClinicalProfile, MedicationWindow } from './types'
import { buildTimeline } from './timeline'
import { buildRiskFlags } from './risk-flags'
import { buildMedicationWindows, activeNow, windowsForDrugClass, windowsForMedicationName, ANTICOAGULANT_DRUG_CLASSES, ANTICOAGULANT_MED_NAMES } from './medication-conflicts'

// ---------------------------------------------------------------------------
// Normalized condition status helper
// ---------------------------------------------------------------------------

/**
 * Normalize the DB medical history status to a canonical NormalizedConditionStatus.
 *
 *   'active'   → 'active'
 *   'resolved' → 'resolved'
 *   'inactive' → 'historical'
 *   other/null → 'unknown'
 */
export function normalizeConditionStatus(
  status: 'active' | 'resolved' | 'inactive' | null | undefined,
): 'active' | 'resolved' | 'historical' | 'unknown' {
  switch (status) {
    case 'active':   return 'active'
    case 'resolved': return 'resolved'
    case 'inactive': return 'historical'
    default:         return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Internal boolean summary helpers
// ---------------------------------------------------------------------------

function computeHasSevereAllergies(profile: SubjectClinicalProfile): boolean {
  return profile.allergies.some(
    (a) =>
      a.status === 'active' &&
      (a.severity === 'severe' || a.severity === 'life-threatening'),
  )
}

function computeHasDrugAllergies(profile: SubjectClinicalProfile): boolean {
  return profile.allergies.some(
    (a) => a.status === 'active' && a.allergen_type === 'drug',
  )
}

function computeHasAnticoagulants(
  medicationWindows: MedicationWindow[],
): boolean {
  const current = activeNow(medicationWindows)

  // Use the same canonical constants and helper path as flagAnticoagulant in risk-flags.ts
  // to guarantee hasAnticoagulants and anticoagulant_present are always consistent.
  const byClass = ANTICOAGULANT_DRUG_CLASSES.flatMap((cls) => windowsForDrugClass(current, cls))
  const byName  = ANTICOAGULANT_MED_NAMES.flatMap((name) => windowsForMedicationName(current, name))

  const seen = new Set<string>()
  return [...byClass, ...byName].some((w) => {
    if (seen.has(w.conmedId)) return false
    seen.add(w.conmedId)
    return true
  })
}

function computeHasRecentSurgery(profile: SubjectClinicalProfile): boolean {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  return profile.surgical_history.some((s) => {
    if (!s.approximate_date || s.date_precision === 'unknown') return false
    const d = Date.parse(s.approximate_date)
    return !isNaN(d) && d >= cutoff.getTime()
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the complete LongitudinalClinicalProfile from a Phase 6C profile.
 *
 * Pure function — no DB calls, no side effects.
 * Performance: O(n) over each clinical section; safe for typical clinical record counts.
 *
 * Recommended usage:
 *   - Call after loadSubjectClinicalProfile() in a server component.
 *   - Cache at the request level via React cache() or unstable_cache() if needed.
 *   - Do NOT call on every render — call once per page load.
 *
 * @param profile  Phase 6C in-memory clinical profile (from loadSubjectClinicalProfile)
 * @returns        LongitudinalClinicalProfile — a richer, derived read model
 */
export function buildLongitudinalProfile(
  profile: SubjectClinicalProfile,
): LongitudinalClinicalProfile {
  const generatedAt = new Date().toISOString()

  // Build core outputs
  const timeline = buildTimeline(profile)
  const medicationWindows = buildMedicationWindows(profile.conmeds)
  const riskFlags = buildRiskFlags(profile)

  // Boolean summaries
  const hasSevereAllergies = computeHasSevereAllergies(profile)
  const hasDrugAllergies = computeHasDrugAllergies(profile)
  const hasAnticoagulants = computeHasAnticoagulants(medicationWindows)
  const hasRecentSurgery = computeHasRecentSurgery(profile)

  // Count summaries
  const activeConditionCount = profile.medical_history.filter(
    (h) => h.status === 'active',
  ).length

  const activeMedicationCount = activeNow(medicationWindows).length

  const activeAllergyCount = profile.allergies.filter(
    (a) => a.status === 'active',
  ).length

  const surgeryCount = profile.surgical_history.length

  // Lifestyle extracts
  const tobaccoStatus = profile.lifestyle?.tobacco_status ?? null
  const alcoholStatus = profile.lifestyle?.alcohol_status ?? null
  const substanceUseStatus = profile.lifestyle?.substance_use_status ?? null

  return {
    studySubjectId: profile.study_subject_id,
    generatedAt,

    // Counts
    activeConditionCount,
    activeMedicationCount,
    activeAllergyCount,
    surgeryCount,

    // Booleans
    hasSevereAllergies,
    hasDrugAllergies,
    hasAnticoagulants,
    hasRecentSurgery,
    tobaccoStatus,
    alcoholStatus,
    substanceUseStatus,

    // Intelligence outputs
    timeline,
    medicationWindows,
    riskFlags,
  }
}
