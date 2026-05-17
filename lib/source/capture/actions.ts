'use server'

import { revalidatePath } from 'next/cache'
import { postSaveDraft, postSubmitResponseSet } from '@/lib/api/source/write-client'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { loadCaptureShell } from '@/lib/source/capture/load-capture-shell'
import { parseCaptureFormToResponses, readCaptureIds } from '@/lib/source/capture/parse-form'
import type { CaptureActionState, CaptureFieldViewModel } from '@/lib/source/capture/types'
import { INITIAL_CAPTURE_ACTION_STATE } from '@/lib/source/capture/types'

function capturePath(procedureExecutionId: string) {
  return `/source/capture/${procedureExecutionId}`
}

function envelopeToMessage(
  envelope: Awaited<ReturnType<typeof postSaveDraft>>,
  title: string,
  successDetail: string,
): CaptureActionState {
  if (envelope.ok) {
    const warnings = envelope.warnings?.map((w) => w.message) ?? []
    return {
      message: {
        kind: 'success',
        title,
        messages: [successDetail, ...(warnings.length ? [`Warnings: ${warnings.join('; ')}`] : [])],
        warnings,
        requestId: envelope.meta?.requestId ?? null,
      },
    }
  }
  const err = normalizeReadPanelError(envelope, title)
  return {
    message: {
      kind: 'error',
      title: err.title,
      messages: err.messages,
      requestId: err.requestId,
    },
  }
}

export async function saveCaptureDraftAction(
  _prev: CaptureActionState,
  formData: FormData,
): Promise<CaptureActionState> {
  const ids = readCaptureIds(formData)
  if (!ids) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: ['Invalid capture identifiers.'],
      },
    }
  }

  const shell = await loadCaptureShell(ids.procedureExecutionId, ids.organizationId)
  if (shell.status === 'error') {
    return { message: { kind: 'error', title: shell.error.title, messages: shell.error.messages } }
  }
  if (!shell.model.canEdit) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: ['Response set is not editable in its current status.'],
      },
    }
  }

  const fieldsJson = formData.get('fields_json')
  let fields: CaptureFieldViewModel[] = shell.model.fields
  if (typeof fieldsJson === 'string' && fieldsJson.trim()) {
    try {
      fields = JSON.parse(fieldsJson) as CaptureFieldViewModel[]
    } catch {
      return {
        message: {
          kind: 'error',
          title: 'Save draft',
          messages: ['Field metadata corrupted; refresh and try again.'],
        },
      }
    }
  }

  const parsed = parseCaptureFormToResponses(formData, fields)
  if (!parsed.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: parsed.messages,
      },
    }
  }

  const envelope = await postSaveDraft({
    organization_id: ids.organizationId,
    source_response_set_id: ids.responseSetId,
    responses: parsed.responses,
  })

  revalidatePath(capturePath(ids.procedureExecutionId))
  return envelopeToMessage(envelope, 'Draft saved', 'Values saved via API. Page refreshed from server.')
}

export async function submitCaptureAction(
  _prev: CaptureActionState,
  formData: FormData,
): Promise<CaptureActionState> {
  const ids = readCaptureIds(formData)
  if (!ids) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: ['Invalid capture identifiers.'],
      },
    }
  }

  const submitReason = String(formData.get('submit_reason') ?? '').trim()
  if (!submitReason) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: ['Submit reason is required.'],
      },
    }
  }

  const shell = await loadCaptureShell(ids.procedureExecutionId, ids.organizationId)
  if (shell.status === 'error') {
    return { message: { kind: 'error', title: shell.error.title, messages: shell.error.messages } }
  }
  if (!shell.model.canEdit) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: ['Response set is already submitted or locked.'],
      },
    }
  }

  const fieldsJson = formData.get('fields_json')
  let fields: CaptureFieldViewModel[] = shell.model.fields
  if (typeof fieldsJson === 'string' && fieldsJson.trim()) {
    try {
      fields = JSON.parse(fieldsJson) as CaptureFieldViewModel[]
    } catch {
      return {
        message: {
          kind: 'error',
          title: 'Submit',
          messages: ['Field metadata corrupted; refresh and try again.'],
        },
      }
    }
  }

  const parsed = parseCaptureFormToResponses(formData, fields)
  if (!parsed.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: parsed.messages,
      },
    }
  }

  const saveEnvelope = await postSaveDraft({
    organization_id: ids.organizationId,
    source_response_set_id: ids.responseSetId,
    responses: parsed.responses,
  })

  if (!saveEnvelope.ok) {
    return envelopeToMessage(saveEnvelope, 'Submit', 'Could not save draft before submit.')
  }

  const submitEnvelope = await postSubmitResponseSet({
    organization_id: ids.organizationId,
    source_response_set_id: ids.responseSetId,
    submit_reason: submitReason,
  })

  revalidatePath(capturePath(ids.procedureExecutionId))
  if (!submitEnvelope.ok) {
    return envelopeToMessage(submitEnvelope, 'Submit', 'Submit failed.')
  }

  return envelopeToMessage(
    submitEnvelope,
    'Submitted',
    'Response set submitted. Capture is now read-only until correction workflows are added.',
  )
}

export { INITIAL_CAPTURE_ACTION_STATE }
