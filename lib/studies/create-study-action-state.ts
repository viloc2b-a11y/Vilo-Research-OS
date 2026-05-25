export type CreateStudyActionState = {
  ok: boolean
  message: string | null
  fieldErrors?: Record<string, string>
}

export const INITIAL_CREATE_STUDY_STATE: CreateStudyActionState = {
  ok: false,
  message: null,
}
