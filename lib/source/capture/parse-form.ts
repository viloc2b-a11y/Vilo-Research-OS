/**
 * Phase 5.2D — FormData → save-draft response items (shape validation only).
 */

import type { DraftResponseItem } from '@/lib/api/source/validate'
import type { CaptureFieldViewModel } from '@/lib/source/capture/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseCaptureFormToResponses(
  formData: FormData,
  fields: CaptureFieldViewModel[],
): { ok: true; responses: DraftResponseItem[] } | { ok: false; messages: string[] } {
  const messages: string[] = []
  const responses: DraftResponseItem[] = []

  for (const field of fields) {
    if (field.runtimeState?.visible === false || field.runtimeState?.disabled === true) {
      continue
    }

    const key = `field_${field.fieldId}`
    const raw = formData.get(key)
    const required = field.runtimeState?.required ?? field.isRequired

    if (field.kind === 'boolean') {
      const checked = raw === 'on' || raw === 'true' || raw === '1'
      if (required && !checked && raw === null) {
        messages.push(`${field.fieldKey}: required`)
      }
      responses.push({ source_field_id: field.fieldId, value_boolean: checked })
      continue
    }

    const text = typeof raw === 'string' ? raw.trim() : ''
    if (required && !text) {
      messages.push(`${field.fieldKey}: required`)
      continue
    }
    if (!text) continue

    switch (field.kind) {
      case 'number': {
        const num = Number(text)
        if (Number.isNaN(num)) {
          messages.push(`${field.fieldKey}: must be a number`)
          break
        }
        responses.push({ source_field_id: field.fieldId, value_number: num })
        break
      }
      case 'date': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          messages.push(`${field.fieldKey}: must be YYYY-MM-DD`)
          break
        }
        responses.push({ source_field_id: field.fieldId, value_date: text })
        break
      }
      case 'json': {
        try {
          responses.push({
            source_field_id: field.fieldId,
            value_json: JSON.parse(text),
          })
        } catch {
          messages.push(`${field.fieldKey}: invalid JSON`)
        }
        break
      }
      default:
        responses.push({ source_field_id: field.fieldId, value_text: text })
    }
  }

  if (messages.length) return { ok: false, messages }
  return { ok: true, responses }
}

export function readCaptureIds(formData: FormData): {
  organizationId: string
  responseSetId: string
  procedureExecutionId: string
} | null {
  const organizationId = String(formData.get('organization_id') ?? '')
  const responseSetId = String(formData.get('response_set_id') ?? '')
  const procedureExecutionId = String(formData.get('procedure_execution_id') ?? '')
  if (
    !UUID_RE.test(organizationId) ||
    !UUID_RE.test(responseSetId) ||
    !UUID_RE.test(procedureExecutionId)
  ) {
    return null
  }
  return { organizationId, responseSetId, procedureExecutionId }
}
