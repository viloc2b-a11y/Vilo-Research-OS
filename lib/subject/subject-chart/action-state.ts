export type SubjectGeneralActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_SUBJECT_GENERAL_STATE: SubjectGeneralActionState = {
  ok: false,
  message: null,
}

export type ExternalRandomizationActionState = SubjectGeneralActionState

export const INITIAL_EXTERNAL_RANDOMIZATION_STATE: ExternalRandomizationActionState = {
  ok: false,
  message: null,
}
