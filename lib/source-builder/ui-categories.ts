import type { LibraryProfileRow } from './types'

/** Coordinator-facing library groupings (Phase 6A.4). */
export const UI_CATEGORY_ORDER = [
  'Protocol Procedures',
  'Regulatory / Enrollment',
  'COA / Questionnaires',
  'Physical Examination',
  'Vital Signs',
  'Concomitant Medication Review',
  'Adverse Event Review',
  'ECG',
  'Labs',
  'Sample Collection',
  'Biological Sample Collection',
  'Imaging',
  'Ophthalmology',
  'Drug Administration / Infusion',
  'Counseling / Patient Education',
  'Reconsent',
  'Remote / Telephone Follow-up',
] as const

const PROFILE_UI_OVERRIDES: Record<string, string> = {
  PROC_RECONSENT: 'Reconsent',
  PROC_COUNSELING_EDUCATION: 'Counseling / Patient Education',
  PROC_CONMED_REVIEW: 'Concomitant Medication Review',
  PROC_AE_REVIEW: 'Adverse Event Review',
  PROC_SAE_REVIEW: 'Adverse Event Review',
  PROC_TELEPHONE_FOLLOWUP: 'Remote / Telephone Follow-up',
  PROC_REMOTE_FOLLOWUP: 'Remote / Telephone Follow-up',
  PROC_IP_ADMINISTRATION: 'Drug Administration / Infusion',
  PROC_INJECTION_SITE_ASSESS: 'Drug Administration / Infusion',
  PROC_POST_DOSE_OBSERVATION: 'Drug Administration / Infusion',
  PROC_BIOLOGIC_SAMPLE_COLLECTION: 'Biological Sample Collection',
  PROC_BLOOD_COLLECTION: 'Sample Collection',
  PROC_ECG_12LEAD: 'ECG',
  PROC_ECG_PK: 'ECG',
  PROC_PHYSICAL_EXAM: 'Physical Examination',
  PROC_TARGETED_PHYSICAL_EXAM: 'Physical Examination',
  PROC_VITAL_SIGNS: 'Vital Signs',
  PROC_HEIGHT: 'Vital Signs',
  PROC_WEIGHT: 'Vital Signs',
}

const CAT_UI_DEFAULT: Record<string, string> = {
  CAT_REGULATORY_ENROLLMENT: 'Regulatory / Enrollment',
  CAT_QUESTIONNAIRE_COA: 'COA / Questionnaires',
  CAT_CLINICAL_REVIEW: 'Protocol Procedures',
  CAT_VITALS_BODY: 'Vital Signs',
  CAT_CARDIAC: 'ECG',
  CAT_LAB_SAMPLE: 'Labs',
  CAT_LAB_PANEL: 'Labs',
  CAT_IMAGING: 'Imaging',
  CAT_OPHTHALMOLOGY: 'Ophthalmology',
  CAT_TREATMENT_IP: 'Drug Administration / Infusion',
  CAT_FOLLOWUP: 'Remote / Telephone Follow-up',
}

export function resolveUiCategory(profile: LibraryProfileRow): string {
  if (PROFILE_UI_OVERRIDES[profile.procedure_profile_code]) {
    return PROFILE_UI_OVERRIDES[profile.procedure_profile_code]
  }
  return CAT_UI_DEFAULT[profile.category] ?? 'Protocol Procedures'
}
