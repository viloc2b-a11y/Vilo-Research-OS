// lib/subject/clinical-intelligence/timeline.ts
// Phase 6D — Deterministic clinical timeline builder.
//
// Consumes SubjectClinicalProfile (Phase 6C in-memory read model).
// No DB calls. Pure, synchronous, deterministic.
//
// Ordering strategy:
//   Primary:   effectiveDate ASC (nulls sorted to end)
//   Secondary: capturedAt ASC (tiebreaker for same-day events)

import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type { ClinicalTimelineEvent } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compare two nullable ISO date strings.
 * nulls sort after non-nulls.
 */
function compareDates(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

function sortTimeline(events: ClinicalTimelineEvent[]): ClinicalTimelineEvent[] {
  return [...events].sort((a, b) => {
    const byEffective = compareDates(a.effectiveDate, b.effectiveDate)
    if (byEffective !== 0) return byEffective
    return compareDates(a.capturedAt, b.capturedAt)
  })
}

// ---------------------------------------------------------------------------
// Medical history → timeline events
// ---------------------------------------------------------------------------

function eventsFromMedicalHistory(
  history: SubjectClinicalProfile['medical_history'],
): ClinicalTimelineEvent[] {
  const events: ClinicalTimelineEvent[] = []

  for (const h of history) {
    const conditionName =
      h.pathology_library?.common_name ?? h.custom_condition_name ?? 'Unknown condition'

    // Diagnosis added
    events.push({
      eventType: 'diagnosis_added',
      entityType: 'medical_history',
      entityId: h.subject_history_id,
      effectiveDate: h.onset_date,
      capturedAt: h.created_at,
      label: `${conditionName} added to medical history`,
      source: h.source_attribution,
      meta: {
        conditionName,
        severity: h.severity,
        status: h.status,
        clinicallySignificant: h.clinically_significant,
        icd10Code: h.pathology_library?.icd10_code ?? null,
        approximateOnset: h.approximate_onset,
      },
    })

    // Diagnosis resolved (only if resolved and we have a meaningful date)
    if (h.status === 'resolved') {
      events.push({
        eventType: 'diagnosis_resolved',
        entityType: 'medical_history',
        entityId: h.subject_history_id,
        effectiveDate: h.end_date,
        capturedAt: h.updated_at,
        label: `${conditionName} resolved`,
        source: h.source_attribution,
        meta: {
          conditionName,
          endDate: h.end_date,
        },
      })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// ConMeds → timeline events
// ---------------------------------------------------------------------------

function eventsFromConMeds(
  conmeds: SubjectClinicalProfile['conmeds'],
): ClinicalTimelineEvent[] {
  const events: ClinicalTimelineEvent[] = []

  for (const c of conmeds) {
    const medName =
      c.medication_library?.medication_name ?? c.custom_medication_name ?? 'Unknown medication'
    const brandSuffix = c.medication_library?.brand_name
      ? ` (${c.medication_library.brand_name})`
      : ''
    const displayName = `${medName}${brandSuffix}`

    // Medication started
    events.push({
      eventType: 'medication_started',
      entityType: 'conmed',
      entityId: c.conmed_id,
      effectiveDate: c.start_date,
      capturedAt: c.created_at,
      label: `${displayName} started`,
      source: c.source_attribution,
      meta: {
        medicationName: medName,
        brandName: c.medication_library?.brand_name ?? null,
        drugClass: c.medication_library?.drug_class ?? null,
        dose: c.dose,
        doseUnit: c.dose_unit,
        route: c.route,
        frequency: c.frequency,
        prn: c.prn,
        ongoing: c.ongoing,
        status: c.status,
        indicationText: c.indication_text,
        indicationCondition:
          c.indication_history?.pathology_library?.common_name ??
          c.indication_history?.custom_condition_name ??
          null,
      },
    })

    // Medication stopped (only if discontinued and a stop date or update exists)
    if (c.status === 'discontinued') {
      events.push({
        eventType: 'medication_stopped',
        entityType: 'conmed',
        entityId: c.conmed_id,
        effectiveDate: c.stop_date,
        capturedAt: c.updated_at,
        label: `${displayName} discontinued${c.reason_stopped ? ` — ${c.reason_stopped}` : ''}`,
        source: c.source_attribution,
        meta: {
          medicationName: medName,
          reasonStopped: c.reason_stopped,
          stopDate: c.stop_date,
        },
      })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Allergies → timeline events
// ---------------------------------------------------------------------------

function eventsFromAllergies(
  allergies: SubjectClinicalProfile['allergies'],
): ClinicalTimelineEvent[] {
  return allergies.map((a) => ({
    eventType: 'allergy_added',
    entityType: 'allergy',
    entityId: a.allergy_id,
    effectiveDate: a.onset_date,
    capturedAt: a.created_at,
    label: `${a.allergen} allergy documented${a.reaction ? ` — ${a.reaction}` : ''}`,
    source: a.source_attribution,
    meta: {
      allergen: a.allergen,
      allergenType: a.allergen_type,
      severity: a.severity,
      reaction: a.reaction,
      status: a.status,
      approximateOnset: a.approximate_onset,
    },
  }))
}

// ---------------------------------------------------------------------------
// Surgical history → timeline events
// ---------------------------------------------------------------------------

function eventsFromSurgicalHistory(
  surgeries: SubjectClinicalProfile['surgical_history'],
): ClinicalTimelineEvent[] {
  return surgeries.map((s) => ({
    eventType: 'surgery_added',
    entityType: 'surgical_history',
    entityId: s.surgical_history_id,
    effectiveDate: s.approximate_date,
    capturedAt: s.created_at,
    label: `${s.procedure_name}${s.outcome ? ` — ${s.outcome}` : ''}`,
    source: s.source_attribution,
    meta: {
      procedureName: s.procedure_name,
      datePrecision: s.date_precision,
      outcome: s.outcome,
    },
  }))
}

// ---------------------------------------------------------------------------
// Lifestyle → timeline event (at most one per subject)
// ---------------------------------------------------------------------------

function eventsFromLifestyle(
  lifestyle: SubjectClinicalProfile['lifestyle'],
): ClinicalTimelineEvent[] {
  if (!lifestyle) return []

  const parts: string[] = []
  if (lifestyle.tobacco_status) parts.push(`tobacco: ${lifestyle.tobacco_status}`)
  if (lifestyle.alcohol_status) parts.push(`alcohol: ${lifestyle.alcohol_status}`)
  if (lifestyle.exercise_frequency) parts.push(`exercise: ${lifestyle.exercise_frequency}`)

  return [
    {
      eventType: 'lifestyle_updated',
      entityType: 'lifestyle',
      entityId: lifestyle.lifestyle_id,
      effectiveDate: null,        // lifestyle has no clinical effective date
      capturedAt: lifestyle.updated_at,
      label: parts.length > 0 ? `Lifestyle documented — ${parts.join(', ')}` : 'Lifestyle documented',
      source: lifestyle.source_attribution,
      meta: {
        tobaccoStatus: lifestyle.tobacco_status,
        alcoholStatus: lifestyle.alcohol_status,
        substanceUseStatus: lifestyle.substance_use_status,
        exerciseFrequency: lifestyle.exercise_frequency,
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the deterministic clinical timeline for a subject.
 *
 * Pure function — no DB calls, no side effects.
 * Safe to call in server components, server actions, or background utilities.
 *
 * @param profile  Phase 6C in-memory clinical profile
 * @returns        Sorted array of ClinicalTimelineEvent (effectiveDate ASC, nulls last)
 */
export function buildTimeline(
  profile: SubjectClinicalProfile,
): ClinicalTimelineEvent[] {
  const events: ClinicalTimelineEvent[] = [
    ...eventsFromMedicalHistory(profile.medical_history),
    ...eventsFromConMeds(profile.conmeds),
    ...eventsFromAllergies(profile.allergies),
    ...eventsFromSurgicalHistory(profile.surgical_history),
    ...eventsFromLifestyle(profile.lifestyle),
    // Phase 6E+ hooks:
    // ...eventsFromAdverseEvents(profile.ae_events),
  ]

  return sortTimeline(events)
}
