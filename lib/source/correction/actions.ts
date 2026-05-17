'use server'

import { revalidatePath } from 'next/cache'
import { postCorrectResponse } from '@/lib/api/source/write-client'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { parseCorrectedValueInput } from '@/lib/source/correction/parse-corrected-value'

export type CorrectionActionMessage = {
  kind: 'success' | 'error'
  title: string
  messages: string[]
  requestId?: string | null
}

export type CorrectionActionState = {
  message: CorrectionActionMessage | null
}

export const INITIAL_CORRECTION_ACTION_STATE: CorrectionActionState = { message: null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function reviewPath(responseSetId: string) {
  return `/source/response-set/${responseSetId}`
}

export async function submitFieldCorrectionAction(
  _prev: CorrectionActionState,
  formData: FormData,
): Promise<CorrectionActionState> {
  const organizationId = String(formData.get('organization_id') ?? '')
  const responseSetId = String(formData.get('response_set_id') ?? '')
  const sourceResponseId = String(formData.get('source_response_id') ?? '')
  const widgetHint = String(formData.get('widget_hint') ?? 'text')
  const reason = String(formData.get('correction_reason') ?? '').trim()
  const correctedRaw = String(formData.get('corrected_value') ?? '')

  if (
    !UUID_RE.test(organizationId) ||
    !UUID_RE.test(responseSetId) ||
    !UUID_RE.test(sourceResponseId)
  ) {
    return {
      message: {
        kind: 'error',
        title: 'Correction',
        messages: ['Invalid identifiers. Refresh the page and try again.'],
      },
    }
  }

  if (!reason) {
    return {
      message: {
        kind: 'error',
        title: 'Correction',
        messages: ['Correction reason is required.'],
      },
    }
  }

  const parsed = parseCorrectedValueInput(correctedRaw, widgetHint)
  if (!parsed.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Correction',
        messages: [parsed.message],
      },
    }
  }

  const envelope = await postCorrectResponse({
    organization_id: organizationId,
    source_response_id: sourceResponseId,
    corrected_value: parsed.value,
    correction_reason: reason,
  })

  revalidatePath(reviewPath(responseSetId))

  if (envelope.ok) {
    const warnings = envelope.warnings?.map((w) => w.message) ?? []
    return {
      message: {
        kind: 'success',
        title: 'Correction recorded',
        messages: [
          'Append-only correction applied via API. Page data refreshed from canonical read APIs.',
          ...(warnings.length ? [`Warnings: ${warnings.join('; ')}`] : []),
        ],
        requestId: envelope.meta?.requestId ?? null,
      },
    }
  }

  const err = normalizeReadPanelError(envelope, 'Correction')
  return {
    message: {
      kind: 'error',
      title: err.title,
      messages: err.messages,
      requestId: err.requestId,
    },
  }
}
