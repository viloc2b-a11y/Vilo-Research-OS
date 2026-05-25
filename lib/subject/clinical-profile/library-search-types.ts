import type { AllergenVocabularyEntry } from '@/lib/subject/clinical-profile/allergy-vocabulary-fallback'

export interface PathologyResult {
  pathology_id: string
  common_name: string
  medical_name: string | null
  icd10_code: string | null
  system: string
}

export interface MedicationResult {
  medication_id: string
  medication_name: string
  brand_name: string | null
  drug_class: string | null
  route: string | null
}

export type MedicationLibrarySearchOutcome = {
  results: MedicationResult[]
  /** Non-blocking client hint when lookup failed; never throws to the page. */
  error?: string
}

export type AllergenResult = AllergenVocabularyEntry
