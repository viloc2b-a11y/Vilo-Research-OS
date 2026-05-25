export type AddendumActionMessage = {
  kind: 'success' | 'error'
  title: string
  messages: string[]
  requestId?: string | null
}

export type AddendumActionState = {
  message: AddendumActionMessage | null
}

export const INITIAL_ADDENDUM_ACTION_STATE: AddendumActionState = { message: null }
