/**
 * Maps existing capture / API response shapes ↔ Phase 1 engine SourceResponses.
 */

import type { CaptureFieldValue, CaptureFieldViewModel } from '@/lib/source/capture/types'
import type { ValidationResult } from '@/lib/source-engine/definitions/types'
import type { FieldResponseValue, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'

/** Capture-layer validation message (compatible with action envelopes). */
export type CaptureValidationError = {
  fieldKey?: string
  sectionId?: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  code: string
  message: string
  blocksSubmission: boolean
  blocksSignature: boolean
  taskEligible?: boolean
}

export function captureFieldValueToEngineValue(
  value: CaptureFieldValue,
): FieldResponseValue {
  if (value.number != null && !Number.isNaN(value.number)) {
    return value.number
  }
  if (value.boolean != null) {
    return value.boolean
  }
  if (value.date != null && value.date !== '') {
    return value.date
  }
  if (value.text != null && value.text !== '') {
    return value.text
  }
  if (value.json != null && value.json.trim() !== '') {
    try {
      const parsed = JSON.parse(value.json) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
      if (typeof parsed === 'number' || typeof parsed === 'boolean') {
        return parsed
      }
      return value.json
    } catch {
      return value.json
    }
  }
  return null
}

/** Flat field map keyed by capture fieldKey for rule engine evaluation. */
export function mapCaptureFieldsToEngineResponses(
  fields: CaptureFieldViewModel[],
): SourceResponses {
  const engineFields: Record<string, FieldResponseValue> = {}
  for (const field of fields) {
    engineFields[field.fieldKey] = captureFieldValueToEngineValue(field.value)
  }
  return { fields: engineFields, repeatableSections: {} }
}

/**
 * Map API draft/submit response rows (field_key + typed value columns) to engine responses.
 */
export function mapApiResponsesToEngineResponses(
  responses: Array<{
    field_key: string
    value_text?: string | null
    value_number?: number | null
    value_boolean?: boolean | null
    value_date?: string | null
    value_json?: unknown
  }>,
): SourceResponses {
  const engineFields: Record<string, FieldResponseValue> = {}
  for (const row of responses) {
    if (row.value_number != null) {
      engineFields[row.field_key] = row.value_number
    } else if (row.value_boolean != null) {
      engineFields[row.field_key] = row.value_boolean
    } else if (row.value_date != null) {
      engineFields[row.field_key] = row.value_date
    } else if (row.value_text != null && row.value_text !== '') {
      engineFields[row.field_key] = row.value_text
    } else if (row.value_json != null) {
      engineFields[row.field_key] =
        typeof row.value_json === 'object'
          ? (row.value_json as FieldResponseValue)
          : String(row.value_json)
    } else {
      engineFields[row.field_key] = null
    }
  }
  return { fields: engineFields, repeatableSections: {} }
}

/** @deprecated Use mapCaptureFieldsToEngineResponses */
export const mapSourceResponsesToEngineResponses = mapCaptureFieldsToEngineResponses

export function mapEngineValidationToCaptureErrors(
  results: ValidationResult[],
): CaptureValidationError[] {
  return results.map((r) => ({
    fieldKey: r.fieldId,
    sectionId: r.sectionId ?? r.repeatableSectionId,
    severity: r.severity,
    code: r.code,
    message: r.message,
    blocksSubmission: r.blocksSubmission,
    blocksSignature: r.blocksSignature,
    taskEligible: r.taskEligible,
  }))
}
