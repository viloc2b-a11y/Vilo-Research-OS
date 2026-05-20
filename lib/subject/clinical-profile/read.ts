// lib/subject/clinical-profile/read.ts
// Canonical read model for the Subject Longitudinal Clinical Profile.
// Loads all 5 sections in parallel — single entrypoint for the UI layer.

import { createServerClient } from '@/lib/supabase/server'
import type {
  SubjectClinicalProfile,
  SubjectMedicalHistory,
  SubjectConMed,
  SubjectAllergy,
  SubjectSurgicalHistory,
  SubjectLifestyle,
  SubjectClinicalProfileEvent,
} from './types'

/**
 * Load the full clinical profile for a study subject.
 * All sections are fetched in parallel.
 * Returns empty arrays for sections with no records.
 */
export async function loadSubjectClinicalProfile(
  study_subject_id: string,
): Promise<SubjectClinicalProfile> {
  const supabase = await createServerClient()

  const [medHistory, conmeds, allergies, surgicalHistory, lifestyle] = await Promise.all([
    // Medical history — join pathology library
    supabase
      .from('subject_medical_history')
      .select(`
        *,
        pathology_library (
          common_name,
          medical_name,
          icd10_code,
          system
        )
      `)
      .eq('study_subject_id', study_subject_id)
      .order('created_at', { ascending: false }),

    // ConMeds — join medication library + indication history
    supabase
      .from('subject_concomitant_medications')
      .select(`
        *,
        medication_library (
          medication_name,
          brand_name,
          drug_class,
          route
        ),
        indication_history:subject_medical_history (
          subject_history_id,
          custom_condition_name,
          pathology_library (
            common_name,
            medical_name,
            icd10_code,
            system
          )
        )
      `)
      .eq('study_subject_id', study_subject_id)
      .order('created_at', { ascending: false }),

    // Allergies
    supabase
      .from('subject_allergies')
      .select('*')
      .eq('study_subject_id', study_subject_id)
      .order('created_at', { ascending: false }),

    // Surgical history
    supabase
      .from('subject_surgical_history')
      .select('*')
      .eq('study_subject_id', study_subject_id)
      .order('approximate_date', { ascending: false, nullsFirst: false }),

    // Lifestyle — one row
    supabase
      .from('subject_lifestyle')
      .select('*')
      .eq('study_subject_id', study_subject_id)
      .maybeSingle(),
  ])

  if (medHistory.error) throw new Error(`loadSubjectClinicalProfile/medical_history: ${medHistory.error.message}`)
  if (conmeds.error) throw new Error(`loadSubjectClinicalProfile/conmeds: ${conmeds.error.message}`)
  if (allergies.error) throw new Error(`loadSubjectClinicalProfile/allergies: ${allergies.error.message}`)
  if (surgicalHistory.error) throw new Error(`loadSubjectClinicalProfile/surgical_history: ${surgicalHistory.error.message}`)
  if (lifestyle.error) throw new Error(`loadSubjectClinicalProfile/lifestyle: ${lifestyle.error.message}`)

  return {
    study_subject_id,
    medical_history: (medHistory.data ?? []) as SubjectMedicalHistory[],
    conmeds: (conmeds.data ?? []) as SubjectConMed[],
    allergies: (allergies.data ?? []) as SubjectAllergy[],
    surgical_history: (surgicalHistory.data ?? []) as SubjectSurgicalHistory[],
    lifestyle: (lifestyle.data ?? null) as SubjectLifestyle | null,
  }
}

/**
 * Load the full audit trail for a specific profile record.
 * Ordered chronologically (oldest first) for reconstruction.
 */
export async function loadProfileRecordAuditTrail(
  record_id: string,
): Promise<SubjectClinicalProfileEvent[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_clinical_profile_events')
    .select('*')
    .eq('record_id', record_id)
    .order('occurred_at', { ascending: true })

  if (error) throw new Error(`loadProfileRecordAuditTrail: ${error.message}`)
  return (data ?? []) as SubjectClinicalProfileEvent[]
}

/**
 * Load the full section audit trail for a subject.
 * Useful for CRA section-level review.
 */
export async function loadProfileSectionAuditTrail(
  study_subject_id: string,
  section: SubjectClinicalProfileEvent['section'],
): Promise<SubjectClinicalProfileEvent[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_clinical_profile_events')
    .select('*')
    .eq('study_subject_id', study_subject_id)
    .eq('section', section)
    .order('occurred_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(`loadProfileSectionAuditTrail: ${error.message}`)
  return (data ?? []) as SubjectClinicalProfileEvent[]
}
