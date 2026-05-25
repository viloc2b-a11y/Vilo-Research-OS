'use server'

import { revalidatePath } from 'next/cache'
import { postAddendum } from '@/lib/api/source/write-client'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { parseAddendumValueInput } from '@/lib/source/addendum/parse-addendum-value'
import type { AddendumActionState } from '@/lib/source/addendum/action-state'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function reviewPath(responseSetId: string) {
  return `/source/response-set/${responseSetId}`
}

export async function submitResponseSetAddendumAction(
  _prev: AddendumActionState,
  formData: FormData,
): Promise<AddendumActionState> {
  const organizationId = String(formData.get('organization_id') ?? '')
  const responseSetId = String(formData.get('response_set_id') ?? '')
  const sourceFieldId = String(formData.get('source_field_id') ?? '')
  const widgetHint = String(formData.get('widget_hint') ?? 'text')
  const sdvRaw = String(formData.get('source_definition_version_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const addendumRaw = String(formData.get('addendum_value') ?? '')

  if (
    !UUID_RE.test(organizationId) ||
    !UUID_RE.test(responseSetId) ||
    !UUID_RE.test(sourceFieldId)
  ) {
    return {
      message: {
        kind: 'error',
        title: 'Addendum',
        messages: ['Invalid identifiers. Refresh the page and try again.'],
      },
    }
  }

  if (!reason) {
    return {
      message: {
        kind: 'error',
        title: 'Addendum',
        messages: ['Late-entry reason / context is required.'],
      },
    }
  }

  const parsed = parseAddendumValueInput(addendumRaw, widgetHint)
  if (!parsed.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Addendum',
        messages: [parsed.message],
      },
    }
  }

  const envelope = await postAddendum({
    organization_id: organizationId,
    source_response_set_id: responseSetId,
    source_field_id: sourceFieldId,
    value: parsed.value,
    reason,
    introduced_by_source_definition_version_id:
      sdvRaw && UUID_RE.test(sdvRaw) ? sdvRaw : null,
  })

  revalidatePath(reviewPath(responseSetId))

  if (envelope.ok) {
    const warnings = envelope.warnings?.map((w) => w.message) ?? []
    return {
      message: {
        kind: 'success',
        title: 'Addendum recorded',
        messages: [
          'Late-entry addendum applied via API. Page data refreshed from canonical read APIs.',
          ...(warnings.length ? [`Warnings: ${warnings.join('; ')}`] : []),
        ],
        requestId: envelope.meta?.requestId ?? null,
      },
    }
  }

  const err = normalizeReadPanelError(envelope, 'Addendum')
  return {
    message: {
      kind: 'error',
      title: err.title,
      messages: err.messages,
      requestId: err.requestId,
    },
  }
}
