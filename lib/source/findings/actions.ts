'use server'

import { revalidatePath } from 'next/cache'
import {
  postAcknowledgeFinding,
  postResolveFinding,
  postWaiveFinding,
} from '@/lib/api/source/write-client'
import type { FindingActionState } from '@/lib/source/findings/action-state'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function reviewPath(responseSetId: string) {
  return `/source/response-set/${responseSetId}`
}

function parseFindingActionForm(formData: FormData) {
  const organizationId = String(formData.get('organization_id') ?? '')
  const responseSetId = String(formData.get('response_set_id') ?? '')
  const findingId = String(formData.get('finding_id') ?? '')
  const text = String(formData.get('text') ?? '').trim()

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(responseSetId) || !UUID_RE.test(findingId)) {
    return {
      ok: false as const,
      message: {
        kind: 'error' as const,
        title: 'Finding action',
        messages: ['Invalid identifiers. Refresh the page and try again.'],
      },
    }
  }

  return {
    ok: true as const,
    organizationId,
    responseSetId,
    findingId,
    text,
  }
}

function successState(
  title: string,
  envelope: Awaited<ReturnType<typeof postAcknowledgeFinding>>,
): FindingActionState {
  const warnings = envelope.warnings?.map((w) => w.message) ?? []
  return {
    message: {
      kind: 'success',
      title,
      messages: [
        'Lifecycle transition applied via API. Findings panel refreshed from canonical read APIs.',
        ...(warnings.length ? [`Warnings: ${warnings.join('; ')}`] : []),
      ],
      requestId: envelope.meta?.requestId ?? null,
    },
  }
}

function errorState(envelope: Awaited<ReturnType<typeof postAcknowledgeFinding>>, label: string) {
  const err = normalizeReadPanelError(envelope, label)
  return {
    message: {
      kind: 'error' as const,
      title: err.title,
      messages: err.messages,
      requestId: err.requestId,
    },
  }
}

export async function acknowledgeFindingAction(
  _prev: FindingActionState,
  formData: FormData,
): Promise<FindingActionState> {
  const parsed = parseFindingActionForm(formData)
  if (!parsed.ok) return { message: parsed.message }

  const envelope = await postAcknowledgeFinding({
    organization_id: parsed.organizationId,
    finding_id: parsed.findingId,
    comment: parsed.text || null,
  })

  revalidatePath(reviewPath(parsed.responseSetId))

  if (envelope.ok) return successState('Finding acknowledged', envelope)
  return errorState(envelope, 'Acknowledge finding')
}

export async function resolveFindingAction(
  _prev: FindingActionState,
  formData: FormData,
): Promise<FindingActionState> {
  const parsed = parseFindingActionForm(formData)
  if (!parsed.ok) return { message: parsed.message }

  if (!parsed.text) {
    return {
      message: {
        kind: 'error',
        title: 'Resolve finding',
        messages: ['Resolution text is required.'],
      },
    }
  }

  const envelope = await postResolveFinding({
    organization_id: parsed.organizationId,
    finding_id: parsed.findingId,
    comment: parsed.text,
  })

  revalidatePath(reviewPath(parsed.responseSetId))

  if (envelope.ok) return successState('Finding resolved', envelope)
  return errorState(envelope, 'Resolve finding')
}

export async function waiveFindingAction(
  _prev: FindingActionState,
  formData: FormData,
): Promise<FindingActionState> {
  const parsed = parseFindingActionForm(formData)
  if (!parsed.ok) return { message: parsed.message }

  if (!parsed.text) {
    return {
      message: {
        kind: 'error',
        title: 'Waive finding',
        messages: ['Waiver reason is required.'],
      },
    }
  }

  const envelope = await postWaiveFinding({
    organization_id: parsed.organizationId,
    finding_id: parsed.findingId,
    comment: parsed.text,
  })

  revalidatePath(reviewPath(parsed.responseSetId))

  if (envelope.ok) return successState('Finding waived', envelope)
  return errorState(envelope, 'Waive finding')
}
