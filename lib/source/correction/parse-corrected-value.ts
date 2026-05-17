/**
 * Phase 5.3A — Shape-only parsing for correction value input (RPC remains authority).
 */

import { resolveCaptureFieldKind } from '@/lib/source/capture/normalize-capture-fields'

export function parseCorrectedValueInput(
  raw: string,
  widgetHint: string | null | undefined,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const text = raw.trim()
  if (!text) {
    return { ok: false, message: 'Corrected value is required.' }
  }

  const kind = resolveCaptureFieldKind(widgetHint, [])

  switch (kind) {
    case 'number': {
      const num = Number(text)
      if (Number.isNaN(num)) return { ok: false, message: 'Corrected value must be a number.' }
      return { ok: true, value: { value_number: num } }
    }
    case 'boolean': {
      const lower = text.toLowerCase()
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return { ok: true, value: { value_boolean: true } }
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return { ok: true, value: { value_boolean: false } }
      }
      return { ok: false, message: 'Use true/false for boolean fields.' }
    }
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return { ok: false, message: 'Date must be YYYY-MM-DD.' }
      }
      return { ok: true, value: { value_date: text } }
    }
    case 'json': {
      try {
        return { ok: true, value: { value_json: JSON.parse(text) } }
      } catch {
        return { ok: false, message: 'Corrected value must be valid JSON.' }
      }
    }
    default:
      return { ok: true, value: { value_text: text } }
  }
}
