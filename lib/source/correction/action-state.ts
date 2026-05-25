export type CorrectionActionMessage = {
  kind: 'success' | 'error'
  title: string
  messages: string[]
  requestId?: string | null
}

export type CorrectionActionState = {
  message: CorrectionActionMessage | null
}

export const INITIAL_CORRECTION_ACTION_STATE: CorrectionActionState = { message: null }
