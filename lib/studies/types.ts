/** DB `studies.status` check constraint values. */
export const STUDY_STATUS_VALUES = ['draft', 'active', 'paused', 'closed'] as const

export type StudyStatusValue = (typeof STUDY_STATUS_VALUES)[number]

export const STUDY_PHASE_OPTIONS = [
  'Phase I',
  'Phase II',
  'Phase III',
  'Phase IV',
  'Phase I/II',
  'Observational',
  'Other',
] as const

export type CreateStudyInput = {
  organizationId: string
  title: string
  studyCode: string
  sponsorName: string
  phase: string
  status: StudyStatusValue
  enrollmentTarget: number | null
}

export type CreateStudyValidationResult =
  | { ok: true; data: CreateStudyInput }
  | { ok: false; errors: Record<string, string> }
