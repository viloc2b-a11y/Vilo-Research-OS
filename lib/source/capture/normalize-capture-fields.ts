/**
 * Phase 5.2D — Map canonical read detail payload to editable capture fields.
 */

import type { ResponseSetDetailData, SourceValuePayload } from '@/lib/api/source/read-types'
import { inferSourceFieldBlindingScope, type SourceFieldBlindingInfo } from '@/lib/source/blinding'
import { parseCaptureFieldOptions } from '@/lib/source/capture/resolve-field-options'
import type { CaptureFieldKind, CaptureFieldValue, CaptureFieldViewModel } from '@/lib/source/capture/types'

function payloadToFieldValue(value: SourceValuePayload | null | undefined): CaptureFieldValue {
  if (!value || typeof value !== 'object') return {}
  if (value.value_text != null && value.value_text !== '') {
    return { text: String(value.value_text) }
  }
  if (value.value_number != null) return { number: value.value_number }
  if (value.value_boolean != null) return { boolean: value.value_boolean }
  if (value.value_date != null) return { date: String(value.value_date) }
  if (value.value_datetime != null) return { text: String(value.value_datetime) }
  if (value.value_json != null) {
    try {
      return { json: JSON.stringify(value.value_json, null, 2) }
    } catch {
      return { json: String(value.value_json) }
    }
  }
  return {}
}

export function resolveCaptureFieldKind(
  widgetHint: string | null | undefined,
  options: string[],
): CaptureFieldKind {
  const hint = String(widgetHint ?? 'text').toLowerCase()
  if (hint.includes('integer') || hint === 'number' || hint === 'numeric') return 'number'
  if (hint === 'boolean' || hint === 'checkbox') return 'boolean'
  if (hint === 'date') return 'date'
  if (hint === 'select' || hint === 'dropdown' || hint === 'enum' || hint === 'choice') {
    return 'select'
  }
  if (hint.includes('json') || hint === 'object') return 'json'
  if (options.length > 0) return 'select'
  return 'text'
}

export function normalizeCaptureFields(
  detail: ResponseSetDetailData,
  optionsByFieldId: Record<string, unknown>,
  blindingByFieldId: Map<string, SourceFieldBlindingInfo> = new Map(),
): CaptureFieldViewModel[] {
  return detail.fields.map((field) => {
    const options = parseCaptureFieldOptions(optionsByFieldId[field.source_field_id])
    const kind = resolveCaptureFieldKind(field.widget_hint, options)
    const blindingInfo = blindingByFieldId.get(field.source_field_id)
    return {
      fieldId: field.source_field_id,
      fieldKey: field.field_key,
      label: field.field_key,
      blindingScope: blindingInfo?.blindingScope ?? inferSourceFieldBlindingScope({
        fieldKey: field.field_key,
        blindingScope: field.blinding_scope,
      }),
      kind,
      isRequired: field.is_required,
      options,
      value: payloadToFieldValue(field.current_effective?.value ?? null),
    }
  })
}
