// lib/subject/clinical-intelligence/types.ts
// Phase 6D — Canonical types for the Longitudinal Clinical Intelligence Layer.
//
// Design contract:
//   - All types are pure data — no DB references, no Supabase imports.
//   - The intelligence layer consumes SubjectClinicalProfile (Phase 6C) and
//     produces LongitudinalClinicalProfile — no new DB tables.
//   - Future hooks (AE, protocol events) are typed but left unimplemented.

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'

// Re-export for consumers that only need the intelligence types
export type { SubjectClinicalProfile }

// ---------------------------------------------------------------------------
// 1. Normalized condition status
// ---------------------------------------------------------------------------

/**
 * Normalized condition lifecycle — extends the DB status with 'historical' and
 * 'unknown' to cover cases where the DB status is 'inactive' or the record
 * predates the status field.
 *
 *   DB status 'active'   → NormalizedConditionStatus 'active'
 *   DB status 'resolved' → NormalizedConditionStatus 'resolved'
 *   DB status 'inactive' → NormalizedConditionStatus 'historical'
 *   missing / null       → NormalizedConditionStatus 'unknown'
 */
export type NormalizedConditionStatus = 'active' | 'resolved' | 'historical' | 'unknown'

// ---------------------------------------------------------------------------
// 2. Clinical timeline
// ---------------------------------------------------------------------------

export type ClinicalTimelineEventType =
  | 'diagnosis_added'
  | 'diagnosis_resolved'
  | 'medication_started'
  | 'medication_stopped'
  | 'allergy_added'
  | 'surgery_added'
  | 'lifestyle_updated'
  | 'ae_added'          // reserved — Phase 6E+
  | 'protocol_event'   // reserved — Phase 6E+

export type ClinicalEntityType =
  | 'medical_history'
  | 'conmed'
  | 'allergy'
  | 'surgical_history'
  | 'lifestyle'
  | 'adverse_event'    // reserved — Phase 6E+

export interface ClinicalTimelineEvent {
  /** Semantic event type */
  eventType: ClinicalTimelineEventType
  /** The entity that generated this event */
  entityType: ClinicalEntityType
  /** PK of the source record */
  entityId: string
  /**
   * Clinical effective date — onset, start_date, surgery date, etc.
   * May be null when the date is genuinely unknown (date_precision === 'unknown').
   */
  effectiveDate: string | null
  /**
   * System capture timestamp — always the record's created_at.
   * Used for ALCOA+ ordering when effectiveDate is null.
   */
  capturedAt: string
  /** Human-readable one-line description for UI rendering */
  label: string
  /** Source attribution forwarded from the profile record */
  source: string | null
  /** Additional structured context (drug class, ICD-10, severity…) */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// 3. Medication temporal window
// ---------------------------------------------------------------------------

export interface MedicationWindow {
  conmedId: string
  /** Resolved display name: medication_library.medication_name or custom_medication_name */
  name: string
  drugClass: string | null
  startDate: string | null
  stopDate: string | null
  ongoing: boolean
  status: 'active' | 'discontinued' | 'on_hold'
  prn: boolean
}

/** A pair of overlapping MedicationWindows */
export interface MedicationWindowOverlap {
  a: MedicationWindow
  b: MedicationWindow
}

// ---------------------------------------------------------------------------
// 4. Risk flags
// ---------------------------------------------------------------------------

export type RiskFlagSeverity = 'info' | 'warning' | 'critical'

export interface ClinicalRiskFlag {
  /** Deterministic, stable slug — safe as a React key */
  id: string
  /** Short display label */
  label: string
  severity: RiskFlagSeverity
  /** Human-readable explanation of why this flag was raised */
  rationale: string
  /** The clinical domain that generated the flag */
  generatedFrom: ClinicalEntityType
  /** PKs of the records that triggered this flag */
  entityIds: string[]
}

// ---------------------------------------------------------------------------
// 5. Protocol exclusion hooks (interface layer only — no engine yet)
// ---------------------------------------------------------------------------

export type ProtocolCriterionType = 'inclusion' | 'exclusion'

export interface ProtocolExclusionResult {
  /** true = this criterion fired (exclusion detected, or inclusion missing) */
  matched: boolean
  /** Criterion descriptor */
  criterionId: string
  criterionType: ProtocolCriterionType
  /** Why the criterion fired */
  reason: string | null
  /** Which entity type triggered it */
  entityType: ClinicalEntityType | null
  /** Which record(s) triggered it */
  entityIds: string[]
}

/**
 * A protocol criterion is a pure function over LongitudinalClinicalProfile.
 * No DB calls — composable, testable, deterministic.
 */
export interface ProtocolCriterion {
  id: string
  type: ProtocolCriterionType
  label: string
  check: (profile: LongitudinalClinicalProfile, raw: SubjectClinicalProfile) => ProtocolExclusionResult
}

// ---------------------------------------------------------------------------
// 6. Top-level aggregated read model
// ---------------------------------------------------------------------------

export interface LongitudinalClinicalProfile {
  studySubjectId: string

  /**
   * ISO timestamp of when this object was computed in memory.
   * NOT persisted — regenerate on each server render or per-request cache.
   */
  generatedAt: string

  // -------------------------------------------------------------------------
  // Summary counts (convenience — avoid recomputing in UI)
  // -------------------------------------------------------------------------
  activeConditionCount: number
  activeMedicationCount: number
  activeAllergyCount: number
  surgeryCount: number

  // -------------------------------------------------------------------------
  // Normalized boolean summaries (derived, deterministic)
  // -------------------------------------------------------------------------

  /** Any active allergy with severity 'severe' or 'life-threatening' */
  hasSevereAllergies: boolean
  /** Any active allergy of type 'drug' */
  hasDrugAllergies: boolean
  /** Any active conmed whose drug_class or name matches an anticoagulant */
  hasAnticoagulants: boolean
  /**
   * Any surgery with approximate_date within the last 12 months.
   * Uses the date at profile generation time.
   */
  hasRecentSurgery: boolean
  /** Derived from lifestyle.tobacco_status */
  tobaccoStatus: 'never' | 'current' | 'former' | 'unknown' | null
  /** Derived from lifestyle.alcohol_status */
  alcoholStatus: 'never' | 'current' | 'former' | 'unknown' | null
  /** Derived from lifestyle.substance_use_status */
  substanceUseStatus: 'none' | 'current' | 'former' | 'unknown' | null

  // -------------------------------------------------------------------------
  // Core intelligence outputs
  // -------------------------------------------------------------------------

  /** Chronological timeline of all clinical events for this subject */
  timeline: ClinicalTimelineEvent[]
  /** All temporally resolved medication windows */
  medicationWindows: MedicationWindow[]
  /** Deterministic risk flags derived from current profile state */
  riskFlags: ClinicalRiskFlag[]

  // -------------------------------------------------------------------------
  // Future extension points — deliberately unimplemented in Phase 6D
  // -------------------------------------------------------------------------
  // ae_events: AdverseEvent[]           // Phase 6E+
  // protocol_events: ProtocolEvent[]    // Phase 6E+
  // eligibilityResults: ProtocolExclusionResult[]  // on-demand via evaluateCriteria()
}
