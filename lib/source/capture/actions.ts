'use server'

import { revalidatePath } from 'next/cache'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { postSaveDraft, postSubmitResponseSet } from '@/lib/api/source/write-client'
import {
  canEditClinicalSource,
  canManageUnblindedData,
  canManageSourceDocuments,
} from '@/lib/rbac/permissions'
import { loadSourceFieldBlindingMap } from '@/lib/source/blinding'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { createServerClient } from '@/lib/supabase/server'
import { loadCaptureShell } from '@/lib/source/capture/load-capture-shell'
import { parseCaptureFormToResponses, readCaptureIds } from '@/lib/source/capture/parse-form'
import type { CaptureActionState, CaptureFieldViewModel } from '@/lib/source/capture/types'
import { INITIAL_CAPTURE_ACTION_STATE } from '@/lib/source/capture/types'
import { materializeEngineTasksAfterSubmit } from '@/lib/source/capture/materialize-engine-tasks'
import {
  bridgeFromProcedureCaptureContext,
  resolveProcedureSourceRuntime,
  resolveSourceEngineRuntimeConfig,
  validateProcedureSourceForSubmit,
} from '@/lib/source-engine/adapters/index'

function capturePath(procedureExecutionId: string) {
  return `/source/capture/${procedureExecutionId}`
}

async function assertCanMutateSourceCapture(organizationId: string): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return 'Sign in required.'

  const memberships = await getOrganizationMemberships(user.id)
  const belongsToOrganization = memberships.some(
    (membership) => membership.organization_id === organizationId,
  )
  if (!belongsToOrganization) return 'You do not have access to this organization.'

  const canMutate =
    canManageSourceDocuments(memberships, organizationId)
    || canEditClinicalSource(memberships, organizationId)

  return canMutate ? null : 'Your role cannot edit source documents for this site.'
}

async function assertCanWriteParsedResponses(input: {
  organizationId: string
  responses: { source_field_id: string }[]
}): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return 'Sign in required.'
  const memberships = await getOrganizationMemberships(user.id)
  const canManageUnblinded = canManageUnblindedData(memberships, input.organizationId)
  if (canManageUnblinded) return null

  const supabase = await createServerClient()
  const blindingByFieldId = await loadSourceFieldBlindingMap(
    supabase,
    input.responses.map((response) => response.source_field_id),
  )
  const blocked = input.responses.find((response) =>
    blindingByFieldId.get(response.source_field_id)?.blindingScope === 'unblinded',
  )
  return blocked
    ? 'Your role cannot save or submit unblinded source fields.'
    : null
}

async function assertProcedureEditable(procedureExecutionId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('procedure_executions')
    .select('is_signed, is_locked, fields_disabled_at, section_disabled_at')
    .eq('id', procedureExecutionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false as const, message: error.message }
  if (!data) return { ok: false as const, message: 'Procedure not found.' }
  if (data.is_signed || data.is_locked) {
    return { ok: false as const, message: 'Procedure is signed/locked and cannot be edited.' }
  }
  if (data.section_disabled_at) {
    return { ok: false as const, message: 'Procedure section is disabled and cannot be edited.' }
  }
  if (data.fields_disabled_at) {
    return { ok: false as const, message: 'Pending fields are disabled and cannot be edited.' }
  }
  return { ok: true as const }
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

  const permissionMessage = await assertCanMutateSourceCapture(ids.organizationId)
  if (permissionMessage) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: [permissionMessage],
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

  const editable = await assertProcedureEditable(ids.procedureExecutionId, ids.organizationId)
  if (!editable.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: [editable.message],
      },
    }
  }

  const fields: CaptureFieldViewModel[] = shell.model.fields

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
  const blindingMessage = await assertCanWriteParsedResponses({
    organizationId: ids.organizationId,
    responses: parsed.responses,
  })
  if (blindingMessage) {
    return {
      message: {
        kind: 'error',
        title: 'Save draft',
        messages: [blindingMessage],
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

  const permissionMessage = await assertCanMutateSourceCapture(ids.organizationId)
  if (permissionMessage) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: [permissionMessage],
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

  const editable = await assertProcedureEditable(ids.procedureExecutionId, ids.organizationId)
  if (!editable.ok) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: [editable.message],
      },
    }
  }

  const fields: CaptureFieldViewModel[] = shell.model.fields

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
  const blindingMessage = await assertCanWriteParsedResponses({
    organizationId: ids.organizationId,
    responses: parsed.responses,
  })
  if (blindingMessage) {
    return {
      message: {
        kind: 'error',
        title: 'Submit',
        messages: [blindingMessage],
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

  let engineAdvisory: string[] = []
  try {
    const engineCheck = validateProcedureSourceForSubmit(
      bridgeFromProcedureCaptureContext(shell.model.context, {
        canEdit: shell.model.canEdit,
        isSubmitted: false,
        responseSetStatus: 'draft',
      }),
      fields,
    )
    engineAdvisory = engineCheck.errors
      .filter((e) => !e.blocksSubmission && (e.severity === 'warning' || e.severity === 'info'))
      .map((e) => `[Engine] ${e.message}`)
  } catch {
    engineAdvisory = []
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

  const base = envelopeToMessage(
    submitEnvelope,
    'Submitted',
    'Response set submitted. Capture is now read-only until correction workflows are added.',
  )

  try {
    const runtimeConfig = await resolveSourceEngineRuntimeConfig({
      procedureExecutionId: ids.procedureExecutionId,
      sourceDefinitionVersionId: shell.model.context.sourceDefinitionVersionId,
      organizationId: ids.organizationId,
      studyId: shell.model.context.studyId,
    })
    if (!runtimeConfig.resolution.fallback) {
      const snapshot = resolveProcedureSourceRuntime(
        bridgeFromProcedureCaptureContext(shell.model.context, {
          canEdit: false,
          isSubmitted: true,
          responseSetStatus: 'submitted',
        }),
        fields,
        { runtimeConfig },
      )
      const taskResult = await materializeEngineTasksAfterSubmit({
        procedureExecutionId: ids.procedureExecutionId,
        organizationId: ids.organizationId,
        responseSetId: ids.responseSetId,
        actorUserId: null,
        snapshot,
      })
      if (taskResult.created > 0 && base.message) {
        base.message.messages.push(
          `Source Engine created ${taskResult.created} coordinator workflow task(s).`,
        )
      }
    }
  } catch {
    // Submit must not fail when task materialization is unavailable.
  }

  if (engineAdvisory.length > 0 && base.message) {
    base.message.warnings = [...(base.message.warnings ?? []), ...engineAdvisory]
    base.message.messages = [
      ...base.message.messages,
      ...engineAdvisory.map((w) => `Advisory: ${w}`),
    ]
  }
  return base
}

export { INITIAL_CAPTURE_ACTION_STATE }
