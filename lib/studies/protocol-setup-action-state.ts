export type ProtocolSetupActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_PROTOCOL_SETUP_STATE: ProtocolSetupActionState = {
  ok: false,
  message: null,
}
