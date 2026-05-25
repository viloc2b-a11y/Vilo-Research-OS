import { coordinatorMessageFromError } from '@/lib/runtime-errors/coordinator-facing'
import { loadSubjectClinicalProfile } from '@/lib/subject/clinical-profile/read'
import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'

const EMPTY_PROFILE = (studySubjectId: string): SubjectClinicalProfile => ({
  study_subject_id: studySubjectId,
  medical_history: [],
  conmeds: [],
  allergies: [],
  surgical_history: [],
  lifestyle: null,
})

export type SubjectClinicalProfileLoadResult =
  | { ok: true; profile: SubjectClinicalProfile }
  | { ok: false; coordinatorMessage: string; profile: SubjectClinicalProfile }

/**
 * Coordinator-safe clinical profile load — never throws to the page boundary.
 */
export async function loadSubjectClinicalProfileSafe(
  studySubjectId: string,
): Promise<SubjectClinicalProfileLoadResult> {
  try {
    const profile = await loadSubjectClinicalProfile(studySubjectId)
    return { ok: true, profile }
  } catch (error) {
    console.error('[loadSubjectClinicalProfileSafe]', error)
    return {
      ok: false,
      coordinatorMessage: coordinatorMessageFromError(error, {
        context: 'subject-clinical-profile',
        fallbackMessage:
          'Clinical profile data could not be loaded right now. You can retry or continue with other subject work.',
      }),
      profile: EMPTY_PROFILE(studySubjectId),
    }
  }
}
