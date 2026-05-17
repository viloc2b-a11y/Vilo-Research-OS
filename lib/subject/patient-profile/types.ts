/** Coordinator documentation — not regulatory diagnosis or prescribing. */

export type PathologyCatalogHit = {
  pathologyId: string
  commonName: string
  medicalName: string | null
  icd10Code: string | null
  system: string
}

export type MedicationCatalogHit = {
  medicationId: string
  medicationName: string
  brandName: string | null
  drugClass: string | null
  route: string | null
  dosageForm: string | null
}

export type SubjectMedicalHistoryRow = {
  subjectHistoryId: string
  organizationId: string
  studySubjectId: string
  pathologyId: string | null
  customConditionName: string | null
  /** UI: start date — stored as onset_date */
  startDate: string | null
  ongoing: boolean
  /** UI: stop date — stored as end_date */
  stopDate: string | null
  clinicallySignificant: boolean | null
  comments: string | null
  displayName: string
  libraryLabel: string | null
  updatedAt: string
}

export type SubjectConmedRow = {
  conmedId: string
  organizationId: string
  studySubjectId: string
  medicationId: string | null
  customMedicationName: string | null
  indicationHistoryId: string | null
  indicationText: string | null
  dose: string | null
  doseUnit: string | null
  frequency: string | null
  route: string | null
  startDate: string | null
  ongoing: boolean
  stopDate: string | null
  comments: string | null
  displayName: string
  libraryLabel: string | null
  updatedAt: string
}

export type PatientProfileActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
