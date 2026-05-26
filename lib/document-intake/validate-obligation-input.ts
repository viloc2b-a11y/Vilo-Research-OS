import {
  ACKNOWLEDGEMENT_TYPE,
  OBLIGATION_TYPE,
  SIGNATURE_MEANING,
  type CreateObligationInput,
} from './obligation-types'

const ACK_VALUES = new Set(Object.values(ACKNOWLEDGEMENT_TYPE))
const SIG_VALUES = new Set(Object.values(SIGNATURE_MEANING))

export function validateObligationInput(
  input: CreateObligationInput,
): { ok: true } | { ok: false; message: string } {
  if (input.obligation_type !== OBLIGATION_TYPE.SIGNATURE && input.obligation_type !== OBLIGATION_TYPE.ACKNOWLEDGEMENT) {
    return { ok: false, message: 'Invalid obligation type.' }
  }

  if (!input.assigned_user_id && !input.assigned_role?.trim()) {
    return { ok: false, message: 'Assign to a user or role.' }
  }

  if (input.obligation_type === OBLIGATION_TYPE.SIGNATURE) {
    if (!input.signature_meaning || !SIG_VALUES.has(input.signature_meaning)) {
      return { ok: false, message: 'Signature meaning is required for signature requests.' }
    }
    if (input.acknowledgement_type) {
      return { ok: false, message: 'Acknowledgement type must be empty for signature requests.' }
    }
  }

  if (input.obligation_type === OBLIGATION_TYPE.ACKNOWLEDGEMENT) {
    if (!input.acknowledgement_type || !ACK_VALUES.has(input.acknowledgement_type)) {
      return { ok: false, message: 'Acknowledgement type is required for acknowledgement requests.' }
    }
    if (input.signature_meaning) {
      return { ok: false, message: 'Signature meaning must be empty for acknowledgement requests.' }
    }
  }

  return { ok: true }
}
