export type FindingActionMessage = {
  kind: 'success' | 'error'
  title: string
  messages: string[]
  requestId?: string | null
}

export type FindingActionState = {
  message: FindingActionMessage | null
}

export const INITIAL_FINDING_ACTION_STATE: FindingActionState = { message: null }
