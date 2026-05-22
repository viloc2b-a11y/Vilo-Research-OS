// lib/subject/clinical-profile/types.ts
// Canonical TypeScript types for the Subject Longitudinal Clinical Profile layer.
// All types map 1:1 to Supabase tables defined in 0052_phase6c1_subject_clinical_profile.sql

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type ClinicalSeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening'
export type ClinicalSeverityWithUnknown = ClinicalSeverity | 'unknown'

export type ProfileSection =
  | 'medical_history'
  | 'conmeds'
  | 'allergies'
  | 'surgical_history'
  | 'lifestyle'
  | 'adverse_events'

export type ClinicalProfileSectionTab = ProfileSection

export type ProfileEventType =
  | 'created'
  | 'updated'
  | 'verified'
  | 'status_changed'
  | 'deleted'

// ---------------------------------------------------------------------------
// Medical History
// ---------------------------------------------------------------------------

export interface SubjectMedicalHistory {
  subject_history_id: string
  organization_id: string
  study_subject_id: string
  pathology_id: string | null
  custom_condition_name: string | null
  onset_date: string | null       // ISO date string
  approximate_onset: boolean
  ongoing: boolean
  end_date: string | null
  clinically_significant: boolean | null
  severity: ClinicalSeverity | null
  source_attribution: string | null
  source_document_ref: string | null
  comments: string | null
  verified_by: string | null
  verified_at: string | null
  status: 'active' | 'resolved' | 'inactive'
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  pathology_library?: {
    common_name: string
    medical_name: string | null
    icd10_code: string | null
    system: string
  } | null
}

export type MedicalHistoryInput = {
  pathology_id?: string | null
  custom_condition_name?: string | null
  onset_date?: string | null
  approximate_onset?: boolean
  ongoing?: boolean
  end_date?: string | null
  clinically_significant?: boolean | null
  severity?: ClinicalSeverity | null
  source_attribution: string        // required
  source_document_ref?: string | null
  comments?: string | null
}

// ---------------------------------------------------------------------------
// Concomitant Medications
// ---------------------------------------------------------------------------

export interface SubjectConMed {
  conmed_id: string
  organization_id: string
  study_subject_id: string
  medication_id: string | null
  custom_medication_name: string | null
  indication_history_id: string | null
  indication_text: string | null
  dose: string | null
  dose_unit: string | null
  frequency: string | null
  route: string | null
  prn: boolean
  start_date: string | null
  ongoing: boolean
  stop_date: string | null
  reason_stopped: string | null
  source_attribution: string | null
  source_document_ref: string | null
  comments: string | null
  verified_by: string | null
  verified_at: string | null
  status: 'active' | 'discontinued' | 'on_hold'
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  medication_library?: {
    medication_name: string
    brand_name: string | null
    drug_class: string | null
    route: string | null
  } | null
  indication_history?: Pick<SubjectMedicalHistory, 'subject_history_id' | 'custom_condition_name' | 'pathology_library'> | null
}

export type ConMedInput = {
  medication_id?: string | null
  custom_medication_name?: string | null
  indication_history_id?: string | null
  indication_text?: string | null
  dose?: string | null
  dose_unit?: string | null
  frequency?: string | null
  route?: string | null
  prn?: boolean
  start_date?: string | null
  ongoing?: boolean
  stop_date?: string | null
  source_attribution: string        // required
  source_document_ref?: string | null
  comments?: string | null
}

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------

export type AllergenType = 'drug' | 'food' | 'environmental' | 'contrast' | 'latex' | 'other'
export type AllergyStatus = 'active' | 'inactive' | 'unconfirmed'

export interface SubjectAllergy {
  allergy_id: string
  organization_id: string
  study_subject_id: string
  allergen: string
  allergen_type: AllergenType | null
  reaction: string | null
  severity: ClinicalSeverityWithUnknown | null
  status: AllergyStatus
  onset_date: string | null
  approximate_onset: boolean
  source_attribution: string | null
  source_document_ref: string | null
  comments: string | null
  verified_by: string | null
  verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AllergyInput = {
  allergen: string                  // required
  allergen_type?: AllergenType | null
  reaction?: string | null
  severity?: ClinicalSeverityWithUnknown | null
  onset_date?: string | null
  approximate_onset?: boolean
  source_attribution: string        // required
  source_document_ref?: string | null
  comments?: string | null
}

// ---------------------------------------------------------------------------
// Surgical History
// ---------------------------------------------------------------------------

export type DatePrecision = 'exact' | 'month' | 'year' | 'decade' | 'unknown'

export interface SubjectSurgicalHistory {
  surgical_history_id: string
  organization_id: string
  study_subject_id: string
  procedure_name: string
  approximate_date: string | null
  date_precision: DatePrecision
  outcome: string | null
  comments: string | null
  source_attribution: string | null
  source_document_ref: string | null
  verified_by: string | null
  verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SurgicalHistoryInput = {
  procedure_name: string            // required
  approximate_date?: string | null
  date_precision?: DatePrecision
  outcome?: string | null
  source_attribution: string        // required
  source_document_ref?: string | null
  comments?: string | null
}

// ---------------------------------------------------------------------------
// Lifestyle
// ---------------------------------------------------------------------------

export type TobaccoStatus = 'never' | 'current' | 'former' | 'unknown'
export type AlcoholStatus = 'never' | 'current' | 'former' | 'unknown'
export type SubstanceUseStatus = 'none' | 'current' | 'former' | 'unknown'
export type ExerciseFrequency = 'none' | 'occasional' | 'moderate' | 'frequent' | 'unknown'

export interface SubjectLifestyle {
  lifestyle_id: string
  organization_id: string
  study_subject_id: string
  tobacco_status: TobaccoStatus | null
  tobacco_type: string | null
  tobacco_packs_per_day: number | null
  tobacco_years: number | null
  tobacco_quit_year: number | null
  alcohol_status: AlcoholStatus | null
  alcohol_drinks_per_week: number | null
  substance_use_status: SubstanceUseStatus | null
  substance_use_details: string | null
  exercise_frequency: ExerciseFrequency | null
  exercise_details: string | null
  comments: string | null
  source_attribution: string | null
  last_updated_by: string | null
  created_at: string
  updated_at: string
}

export type LifestyleInput = {
  tobacco_status?: TobaccoStatus | null
  tobacco_type?: string | null
  tobacco_packs_per_day?: number | null
  tobacco_years?: number | null
  tobacco_quit_year?: number | null
  alcohol_status?: AlcoholStatus | null
  alcohol_drinks_per_week?: number | null
  substance_use_status?: SubstanceUseStatus | null
  substance_use_details?: string | null
  exercise_frequency?: ExerciseFrequency | null
  exercise_details?: string | null
  comments?: string | null
  source_attribution: string        // required
}

// ---------------------------------------------------------------------------
// Audit Event
// ---------------------------------------------------------------------------

export interface SubjectClinicalProfileEvent {
  event_id: string
  organization_id: string
  study_subject_id: string
  section: ProfileSection
  record_id: string
  event_type: ProfileEventType
  actor_id: string
  actor_role: string | null
  occurred_at: string
  before_snapshot: Record<string, unknown> | null
  after_snapshot: Record<string, unknown>
  change_reason: string | null
  source_attribution: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Canonical read model — full clinical profile
// ---------------------------------------------------------------------------

export interface SubjectClinicalProfile {
  study_subject_id: string
  medical_history: SubjectMedicalHistory[]
  conmeds: SubjectConMed[]
  allergies: SubjectAllergy[]
  surgical_history: SubjectSurgicalHistory[]
  lifestyle: SubjectLifestyle | null
}
