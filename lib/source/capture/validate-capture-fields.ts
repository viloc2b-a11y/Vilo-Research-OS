/**
 * Validate capture fields against published SDV requirements (not full engine template).
 */

import type { CaptureFieldViewModel } from '@/lib/source/capture/types'
import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'

function isEmptyValue(field: CaptureFieldViewModel): boolean {
  if (field.kind === 'boolean') {
    return field.value.boolean !== true
  }
  if (field.kind === 'number') {
    return field.value.number == null || Number.isNaN(field.value.number)
  }
  if (field.kind === 'date') {
    return !field.value.date
  }
  if (field.kind === 'json') {
    return !field.value.json?.trim()
  }
  return !field.value.text?.trim()
}

export function validateCaptureFieldsForSubmit(fields: CaptureFieldViewModel[]): {
  valid: boolean
  errors: CaptureValidationError[]
  blocksSubmission: boolean
} {
  const errors: CaptureValidationError[] = []

  for (const field of fields) {
    if (field.runtimeState?.visible === false) continue
    // Published SDV required fields stay in submit scope even when engine marks them disabled.
    if (field.runtimeState?.disabled === true && !field.isRequired) continue

    if (!field.isRequired) continue

    if (isEmptyValue(field)) {
      errors.push({
        fieldKey: field.fieldKey,
        severity: 'error',
        code: 'REQUIRED_FIELD_EMPTY',
        message: `${field.label} is required`,
        blocksSubmission: true,
        blocksSignature: false,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    blocksSubmission: errors.some((e) => e.blocksSubmission),
  }
}
