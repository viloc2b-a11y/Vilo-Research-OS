/**
 * Normalize source field values and compute SHA256 hashes (never store raw values).
 */

import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@/lib/source/integrity/canonical-serialize'
import type { SourceFieldValueSlots } from '@/lib/source/integrity/types'

function normalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item))
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const out: Record<string, unknown> = {}
    for (const key of keys) {
      out[key] = normalizeJsonValue(record[key])
    }
    return out
  }
  return value
}

export function normalizeSourceFieldValueForHash(slots: SourceFieldValueSlots): string {
  const payload = {
    value_type: slots.valueType ?? null,
    value_text: slots.valueText ?? null,
    value_number: slots.valueNumber ?? null,
    value_boolean: slots.valueBoolean ?? null,
    value_date: slots.valueDate ?? null,
    value_datetime: slots.valueDatetime ?? null,
    value_json: normalizeJsonValue(slots.valueJson ?? null),
  }
  return canonicalSerialize(payload)
}

export function hashFieldValue(slots: SourceFieldValueSlots): string {
  const normalized = normalizeSourceFieldValueForHash(slots)
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

export function sourceFieldValueHasContent(slots: SourceFieldValueSlots): boolean {
  if (slots.valueText != null) return true
  if (slots.valueNumber != null) return true
  if (slots.valueBoolean != null) return true
  if (slots.valueDate != null) return true
  if (slots.valueDatetime != null) return true
  if (slots.valueJson != null) return true
  return false
}
