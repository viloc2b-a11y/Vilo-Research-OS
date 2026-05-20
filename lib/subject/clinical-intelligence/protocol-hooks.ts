// lib/subject/clinical-intelligence/protocol-hooks.ts
// Phase 6D — Protocol exclusion / inclusion criterion hook layer.
//
// Design intent:
//   This file defines the *interface* and *composition utilities* for protocol
//   criteria. It does NOT implement a protocol engine, scoring system, or AI.
//
//   Usage pattern (by a future protocol module or study config layer):
//
//     const criteria: ProtocolCriterion[] = [
//       hasProhibitedMedication(['warfarin', 'apixaban'], 'EXCL-02'),
//       hasExclusionaryCondition(['lupus', 'rheumatoid arthritis'], 'EXCL-05'),
//       hasConflictingSurgery(['cardiac surgery', 'bypass'], 'EXCL-07'),
//       hasRiskFactor('anticoagulant_present', 'EXCL-10'),
//     ]
//     const results = evaluateCriteria(criteria, longitudinalProfile, rawProfile)
//
// All criterion functions are pure — no DB calls, no network I/O.

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type {
  LongitudinalClinicalProfile,
  ProtocolCriterion,
  ProtocolExclusionResult,
  ProtocolCriterionType,
} from './types'
import { activeNow, windowsForDrugClass, windowsForMedicationName, buildMedicationWindows } from './medication-conflicts'

// ---------------------------------------------------------------------------
// Criterion factory functions
// ---------------------------------------------------------------------------

/**
 * Creates a criterion that fires if the subject has any ACTIVE medical history
 * record whose condition name (pathology library common name OR custom name)
 * contains any of the provided search terms (case-insensitive substring match).
 *
 * @param conditionTerms  e.g. ['diabetes', 'renal failure', 'HIV']
 * @param criterionId     Protocol-defined criterion ID (e.g. 'EXCL-03')
 */
export function hasExclusionaryCondition(
  conditionTerms: string[],
  criterionId: string,
): ProtocolCriterion {
  const terms = conditionTerms.map((t) => t.toLowerCase())

  return {
    id: criterionId,
    type: 'exclusion' as ProtocolCriterionType,
    label: `Exclusionary condition: ${conditionTerms.join(', ')}`,
    check: (
      _profile: LongitudinalClinicalProfile,
      raw: SubjectClinicalProfile,
    ): ProtocolExclusionResult => {
      const matched = raw.medical_history.filter((h) => {
        if (h.status === 'resolved') return false   // resolved conditions do not exclude by default
        const name = (
          h.pathology_library?.common_name ?? h.custom_condition_name ?? ''
        ).toLowerCase()
        const medName = (h.pathology_library?.medical_name ?? '').toLowerCase()
        return terms.some((t) => name.includes(t) || medName.includes(t))
      })

      if (matched.length === 0) {
        return {
          matched: false,
          criterionId,
          criterionType: 'exclusion',
          reason: null,
          entityType: null,
          entityIds: [],
        }
      }

      const names = matched.map(
        (h) => h.pathology_library?.common_name ?? h.custom_condition_name ?? 'Unknown',
      )

      return {
        matched: true,
        criterionId,
        criterionType: 'exclusion',
        reason: `Subject has active condition(s) matching exclusion criteria: ${names.join(', ')}.`,
        entityType: 'medical_history',
        entityIds: matched.map((h) => h.subject_history_id),
      }
    },
  }
}

/**
 * Creates a criterion that fires if the subject has any CURRENTLY ACTIVE
 * medication whose name or drug class matches any of the provided terms
 * (case-insensitive substring match).
 *
 * @param medicationTerms  e.g. ['warfarin', 'MAO inhibitor', 'lithium']
 * @param criterionId      Protocol-defined criterion ID
 */
export function hasProhibitedMedication(
  medicationTerms: string[],
  criterionId: string,
): ProtocolCriterion {
  const terms = medicationTerms.map((t) => t.toLowerCase())

  return {
    id: criterionId,
    type: 'exclusion' as ProtocolCriterionType,
    label: `Prohibited medication: ${medicationTerms.join(', ')}`,
    check: (
      _profile: LongitudinalClinicalProfile,
      raw: SubjectClinicalProfile,
    ): ProtocolExclusionResult => {
      const windows = buildMedicationWindows(raw.conmeds)
      const current = activeNow(windows)

      const byName = terms.flatMap((t) => windowsForMedicationName(current, t))
      const byClass = terms.flatMap((t) => windowsForDrugClass(current, t))

      const seen = new Set<string>()
      const matched = [...byName, ...byClass].filter((w) => {
        if (seen.has(w.conmedId)) return false
        seen.add(w.conmedId)
        return true
      })

      if (matched.length === 0) {
        return {
          matched: false,
          criterionId,
          criterionType: 'exclusion',
          reason: null,
          entityType: null,
          entityIds: [],
        }
      }

      return {
        matched: true,
        criterionId,
        criterionType: 'exclusion',
        reason: `Subject is on prohibited medication(s): ${matched.map((m) => m.name).join(', ')}.`,
        entityType: 'conmed',
        entityIds: matched.map((m) => m.conmedId),
      }
    },
  }
}

/**
 * Creates a criterion that fires if the subject has a surgical history entry
 * whose procedure_name contains any of the provided terms (case-insensitive).
 *
 * @param procedureTerms  e.g. ['cardiac surgery', 'bypass', 'valve replacement']
 * @param criterionId     Protocol-defined criterion ID
 * @param withinMonths    Optional: only consider surgeries within N months (default: all time)
 */
export function hasConflictingSurgery(
  procedureTerms: string[],
  criterionId: string,
  withinMonths?: number,
): ProtocolCriterion {
  const terms = procedureTerms.map((t) => t.toLowerCase())

  return {
    id: criterionId,
    type: 'exclusion' as ProtocolCriterionType,
    label: `Conflicting surgery: ${procedureTerms.join(', ')}`,
    check: (
      _profile: LongitudinalClinicalProfile,
      raw: SubjectClinicalProfile,
    ): ProtocolExclusionResult => {
      const cutoff = withinMonths
        ? (() => {
            const d = new Date()
            d.setMonth(d.getMonth() - withinMonths)
            return d.getTime()
          })()
        : null

      const matched = raw.surgical_history.filter((s) => {
        const procedureMatch = terms.some((t) => s.procedure_name.toLowerCase().includes(t))
        if (!procedureMatch) return false

        if (cutoff !== null && s.approximate_date) {
          const d = Date.parse(s.approximate_date)
          if (!isNaN(d) && d < cutoff) return false   // too old
        }

        return true
      })

      if (matched.length === 0) {
        return {
          matched: false,
          criterionId,
          criterionType: 'exclusion',
          reason: null,
          entityType: null,
          entityIds: [],
        }
      }

      const names = matched.map((s) => s.procedure_name)
      const timeLabel = withinMonths ? ` within the last ${withinMonths} months` : ''

      return {
        matched: true,
        criterionId,
        criterionType: 'exclusion',
        reason: `Subject has conflicting surgical history${timeLabel}: ${names.join(', ')}.`,
        entityType: 'surgical_history',
        entityIds: matched.map((s) => s.surgical_history_id),
      }
    },
  }
}

/**
 * Creates a criterion that fires if the LongitudinalClinicalProfile
 * contains a specific risk flag ID (from the risk-flags engine).
 *
 * Delegates flag evaluation to the pre-computed LongitudinalClinicalProfile,
 * so this criterion is only valid after buildLongitudinalProfile() runs.
 *
 * @param flagId       e.g. 'anticoagulant_present', 'severe_allergy_present'
 * @param criterionId  Protocol-defined criterion ID
 */
export function hasRiskFactor(
  flagId: string,
  criterionId: string,
): ProtocolCriterion {
  return {
    id: criterionId,
    type: 'exclusion' as ProtocolCriterionType,
    label: `Risk factor present: ${flagId}`,
    check: (
      profile: LongitudinalClinicalProfile,
      raw: SubjectClinicalProfile,
    ): ProtocolExclusionResult => {
      void raw
      const flag = profile.riskFlags.find((f) => f.id === flagId)

      if (!flag) {
        return {
          matched: false,
          criterionId,
          criterionType: 'exclusion',
          reason: null,
          entityType: null,
          entityIds: [],
        }
      }

      return {
        matched: true,
        criterionId,
        criterionType: 'exclusion',
        reason: flag.rationale,
        entityType: flag.generatedFrom,
        entityIds: flag.entityIds,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Evaluation runner
// ---------------------------------------------------------------------------

/**
 * Run an array of protocol criteria against a subject's longitudinal profile.
 *
 * Returns results for ALL criteria (both matched and unmatched).
 * The caller decides how to interpret results (e.g., any exclusion → ineligible).
 *
 * Pure function — no DB calls, no side effects.
 *
 * @param criteria    Array of ProtocolCriterion (built with factory functions above)
 * @param profile     Pre-built LongitudinalClinicalProfile
 * @param raw         Phase 6C SubjectClinicalProfile (for record-level access)
 * @returns           ProtocolExclusionResult[] — one per criterion
 */
export function evaluateCriteria(
  criteria: ProtocolCriterion[],
  profile: LongitudinalClinicalProfile,
  raw: SubjectClinicalProfile,
): ProtocolExclusionResult[] {
  return criteria.map((criterion) => criterion.check(profile, raw))
}

/**
 * Returns only the criteria that fired (matched: true).
 * Convenience wrapper around evaluateCriteria.
 */
export function findMatchedExclusions(
  criteria: ProtocolCriterion[],
  profile: LongitudinalClinicalProfile,
  raw: SubjectClinicalProfile,
): ProtocolExclusionResult[] {
  return evaluateCriteria(criteria, profile, raw).filter((r) => r.matched)
}
