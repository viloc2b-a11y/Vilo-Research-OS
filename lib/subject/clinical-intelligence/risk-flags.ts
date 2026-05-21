// lib/subject/clinical-intelligence/risk-flags.ts
// Phase 6D — Lightweight deterministic risk flag engine.
//
// Flags are:
//   - 100% deterministic — same input always produces same output
//   - Explainable — each flag carries a human-readable rationale
//   - Generated from current profile state only
//   - No machine learning, no probabilistic scoring
//
// Flag vocabulary is intentionally minimal.
// New flags should be added when a specific clinical workflow requires them —
// not speculatively.

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type { ClinicalRiskFlag } from './types'
import {
  buildMedicationWindows,
  activeNow,
  windowsForDrugClass,
  windowsForMedicationName,
  ANTICOAGULANT_DRUG_CLASSES,
  ANTICOAGULANT_MED_NAMES,
} from './medication-conflicts'

// (anticoagulant lists imported from ./medication-conflicts — single source of truth)

// Known pain medication drug classes
const PAIN_MED_DRUG_CLASSES = [
  'opioid',
  'analgesic',
  'nsaid',
  'cox-2 inhibitor',
  'muscle relaxant',
]

const PAIN_MED_NAMES = [
  'tramadol',
  'oxycodone',
  'hydrocodone',
  'morphine',
  'fentanyl',
  'codeine',
  'ibuprofen',
  'naproxen',
  'celecoxib',
  'acetaminophen',
  'paracetamol',
  'diclofenac',
  'ketorolac',
  'meloxicam',
  'cyclobenzaprine',
  'methocarbamol',
]

// ---------------------------------------------------------------------------
// Individual flag generators
// ---------------------------------------------------------------------------

/**
 * FLAG: severe_allergy_present
 * Any active allergy with severity 'severe' or 'life-threatening'.
 */
function flagSevereAllergy(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const severe = profile.allergies.filter(
    (a) =>
      a.status === 'active' &&
      (a.severity === 'severe' || a.severity === 'life-threatening'),
  )
  if (severe.length === 0) return null

  return {
    id: 'severe_allergy_present',
    label: 'Severe allergy documented',
    severity: 'critical',
    rationale: `Subject has ${severe.length} active allergy record(s) with severity 'severe' or 'life-threatening': ${severe.map((a) => a.allergen).join(', ')}.`,
    generatedFrom: 'allergy',
    entityIds: severe.map((a) => a.allergy_id),
  }
}

/**
 * FLAG: drug_allergy_present
 * Any active allergy of type 'drug'.
 */
function flagDrugAllergy(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const drug = profile.allergies.filter(
    (a) => a.status === 'active' && a.allergen_type === 'drug',
  )
  if (drug.length === 0) return null

  return {
    id: 'drug_allergy_present',
    label: 'Active drug allergy',
    severity: 'warning',
    rationale: `Subject has ${drug.length} active drug allergy record(s): ${drug.map((a) => a.allergen).join(', ')}.`,
    generatedFrom: 'allergy',
    entityIds: drug.map((a) => a.allergy_id),
  }
}

/**
 * FLAG: anticoagulant_present
 * Any active medication whose drug_class or name matches a known anticoagulant.
 */
function flagAnticoagulant(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const windows = buildMedicationWindows(profile.conmeds)
  const current = activeNow(windows)

  const byClass = ANTICOAGULANT_DRUG_CLASSES.flatMap((cls) =>
    windowsForDrugClass(current, cls),
  )
  const byName = ANTICOAGULANT_MED_NAMES.flatMap((name) =>
    windowsForMedicationName(current, name),
  )

  // Deduplicate by conmedId
  const seen = new Set<string>()
  const matched = [...byClass, ...byName].filter((w) => {
    if (seen.has(w.conmedId)) return false
    seen.add(w.conmedId)
    return true
  })

  if (matched.length === 0) return null

  return {
    id: 'anticoagulant_present',
    label: 'Active anticoagulant therapy',
    severity: 'warning',
    rationale: `Subject is currently on ${matched.length} anticoagulant medication(s): ${matched.map((m) => m.name).join(', ')}.`,
    generatedFrom: 'conmed',
    entityIds: matched.map((m) => m.conmedId),
  }
}

/**
 * FLAG: recent_surgery
 * Any surgery with approximate_date within the last 12 months.
 * Surgeries with null or 'unknown' precision dates are excluded (cannot be determined).
 */
function flagRecentSurgery(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  const recent = profile.surgical_history.filter((s) => {
    if (!s.approximate_date || s.date_precision === 'unknown') return false
    const d = Date.parse(s.approximate_date)
    return !isNaN(d) && d >= cutoff.getTime()
  })

  if (recent.length === 0) return null

  return {
    id: 'recent_surgery',
    label: 'Recent surgery (< 12 months)',
    severity: 'warning',
    rationale: `Subject had ${recent.length} surgical procedure(s) within the last 12 months: ${recent.map((s) => s.procedure_name).join(', ')}.`,
    generatedFrom: 'surgical_history',
    entityIds: recent.map((s) => s.surgical_history_id),
  }
}

/**
 * FLAG: current_smoker
 * tobacco_status === 'current' in lifestyle record.
 */
function flagCurrentSmoker(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  if (profile.lifestyle?.tobacco_status !== 'current') return null

  const ppd = profile.lifestyle.tobacco_packs_per_day
  const years = profile.lifestyle.tobacco_years

  return {
    id: 'current_smoker',
    label: 'Current tobacco use',
    severity: 'info',
    rationale: `Subject currently uses tobacco${ppd ? ` (${ppd} ppd` : ''}${years ? `, ${years} year history` : ''}${ppd || years ? ')' : ''}.`,
    generatedFrom: 'lifestyle',
    entityIds: [profile.lifestyle.lifestyle_id],
  }
}

/**
 * FLAG: multiple_active_pain_medications
 * Two or more active medications matching known pain medication classes/names.
 */
function flagMultipleActivePainMeds(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const windows = buildMedicationWindows(profile.conmeds)
  const current = activeNow(windows)

  const byClass = PAIN_MED_DRUG_CLASSES.flatMap((cls) =>
    windowsForDrugClass(current, cls),
  )
  const byName = PAIN_MED_NAMES.flatMap((name) =>
    windowsForMedicationName(current, name),
  )

  const seen = new Set<string>()
  const matched = [...byClass, ...byName].filter((w) => {
    if (seen.has(w.conmedId)) return false
    seen.add(w.conmedId)
    return true
  })

  if (matched.length < 2) return null

  return {
    id: 'multiple_active_pain_medications',
    label: 'Multiple active pain medications',
    severity: 'warning',
    rationale: `Subject has ${matched.length} concurrent pain medications: ${matched.map((m) => m.name).join(', ')}.`,
    generatedFrom: 'conmed',
    entityIds: matched.map((m) => m.conmedId),
  }
}

/**
 * FLAG: active_severe_condition
 * Any medical history entry with severity 'severe' or 'life-threatening'
 * and status 'active'.
 */
function flagActiveSevereCondition(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  const severe = profile.medical_history.filter(
    (h) =>
      h.status === 'active' &&
      (h.severity === 'severe' || h.severity === 'life-threatening'),
  )
  if (severe.length === 0) return null

  const names = severe.map(
    (h) => h.pathology_library?.common_name ?? h.custom_condition_name ?? 'Unknown',
  )

  return {
    id: 'active_severe_condition',
    label: 'Active severe medical condition',
    severity: 'critical',
    rationale: `Subject has ${severe.length} active medical condition(s) documented as 'severe' or 'life-threatening': ${names.join(', ')}.`,
    generatedFrom: 'medical_history',
    entityIds: severe.map((h) => h.subject_history_id),
  }
}

/**
 * FLAG: substance_use_active
 * Current substance use status (non-tobacco, non-alcohol).
 */
function flagSubstanceUse(profile: SubjectClinicalProfile): ClinicalRiskFlag | null {
  if (profile.lifestyle?.substance_use_status !== 'current') return null

  const details = profile.lifestyle.substance_use_details

  return {
    id: 'substance_use_active',
    label: 'Current substance use documented',
    severity: 'info',
    rationale: `Subject reports current substance use${details ? `: ${details}` : ''}.`,
    generatedFrom: 'lifestyle',
    entityIds: [profile.lifestyle.lifestyle_id],
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all applicable risk flags for a clinical profile.
 *
 * Pure function — no DB calls, no side effects.
 * Flags are returned in order of severity: critical → warning → info.
 *
 * @param profile  Phase 6C in-memory clinical profile
 * @returns        Array of ClinicalRiskFlag (may be empty)
 */
export function buildRiskFlags(profile: SubjectClinicalProfile): ClinicalRiskFlag[] {
  const generators = [
    flagActiveSevereCondition,
    flagSevereAllergy,
    flagAnticoagulant,
    flagRecentSurgery,
    flagDrugAllergy,
    flagMultipleActivePainMeds,
    flagCurrentSmoker,
    flagSubstanceUse,
  ]

  const allFlags = generators
    .map((gen) => gen(profile))
    .filter((f): f is ClinicalRiskFlag => f !== null)

  // Sort: critical → warning → info
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  return allFlags.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
}

/**
 * Quick boolean check — does this profile have any critical-severity flags?
 * Useful for a summary badge without running the full flag suite.
 */
export function hasCriticalFlags(profile: SubjectClinicalProfile): boolean {
  return buildRiskFlags(profile).some((f) => f.severity === 'critical')
}
