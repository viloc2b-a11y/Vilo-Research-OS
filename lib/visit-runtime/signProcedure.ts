import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import {
  captureSourceSnapshotBestEffort,
  SOURCE_SNAPSHOT_TYPE,
} from '@/lib/source/integrity'
import { materializeEngineTasksAfterSignatureBlock } from '@/lib/source/capture/materialize-engine-tasks'
import { checkEngineSignatureReadiness } from '@/lib/source/capture/engine-signature-validation'
import { isSourceCaptureSubmitted } from '@/lib/source/submitted-source-gate'
import { coordinatorMessageFromError } from '@/lib/runtime-errors'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import type { createServerClient } from '@/lib/supabase/server'
import { requestOperationalSignature } from '@/lib/operations/signature-actions'
import { enforceConsentForProcedureExecution } from '@/lib/subject/consent/enforcement'
import { requestProcedureSignatureLink } from '@/lib/operations/clinical-record-mutations'

type Supabase = Awaited<ReturnType<typeof createServerClient>>
type ProcedureValidation = Awaited<ReturnType<typeof validateProcedure>>

export async function requestProcedureSignature(params: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  actorUserId: string
  expectedUpdatedAt?: string | null
}) {
  const { data: proc, error: procError } = await params.supabase
    .from('procedure_executions')
    .select('id, organization_id, study_id, visit_id, is_signed, signed_at, signed_by, is_locked, section_disabled_at, updated_at, visits!inner(visit_status, study_subject_id), procedure_definitions(code, label)')
    .eq('id', params.procedureExecutionId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  if (procError) {
    return {
      ok: false as const,
      error: coordinatorMessageFromError(procError, {
        context: 'sign_procedure',
        fallbackMessage: 'Could not load procedure for signing.',
      }),
    }
  }
  if (!proc) return { ok: false as const, error: 'Procedure not found.' }

  if (params.expectedUpdatedAt && proc.updated_at !== params.expectedUpdatedAt) {
    return { ok: false as const, error: 'This visit or source was updated elsewhere. Please refresh before signing.' }
  }

  // @ts-expect-error - PostgREST response shape is slightly tricky with inner joins
  const visitStatus = proc.visits?.visit_status as string | undefined
  if (visitStatus && ['locked', 'completed', 'cancelled', 'no_show'].includes(visitStatus)) {
    return { ok: false as const, error: `Cannot sign procedure: visit is ${visitStatus}.` }
  }

  if (proc.is_signed) {
    return {
      ok: true as const,
      idempotent: true as const,
      signedAt: (proc.signed_at as string | null) ?? null,
      signedBy: (proc.signed_by as string | null) ?? null,
    }
  }
  if (proc.section_disabled_at) {
    return { ok: false as const, error: 'Cannot sign: procedure section is disabled.' }
  }

  // @ts-expect-error - PostgREST response shape is slightly tricky with inner joins
  const studySubjectId = proc.visits?.study_subject_id as string | undefined
  const procedureDefinition = Array.isArray(proc.procedure_definitions)
    ? proc.procedure_definitions[0]
    : proc.procedure_definitions
  const consent = await enforceConsentForProcedureExecution(
    {
      supabase: params.supabase,
      organizationId: params.organizationId,
      studyId: proc.study_id as string,
      subjectId: studySubjectId ?? '',
      visitId: proc.visit_id as string,
      procedureExecutionId: params.procedureExecutionId,
      actorUserId: params.actorUserId,
    },
    {
      code: typeof procedureDefinition?.code === 'string' ? procedureDefinition.code : null,
      label: typeof procedureDefinition?.label === 'string' ? procedureDefinition.label : null,
    },
  )
  if (!consent.ok) return { ok: false as const, error: consent.message }

  const validation = await validateProcedure({
    supabase: params.supabase,
    procedureExecutionId: params.procedureExecutionId,
    organizationId: params.organizationId,
  })

  if (validation.status === 'blocked' || validation.status === 'incomplete') {
    return {
      ok: false as const,
      error: `Cannot sign: ${validation.alerts.map((a) => a.message).join('; ')}`,
      validation,
    }
  }

  if (validation.responseSetId) {
    const { data: responseSetRow } = await params.supabase
      .from('source_response_sets')
      .select('status')
      .eq('id', validation.responseSetId)
      .eq('organization_id', params.organizationId)
      .maybeSingle()

    if (!isSourceCaptureSubmitted(responseSetRow?.status as string | undefined)) {
      return {
        ok: false as const,
        error: 'Source capture must be submitted before signing the procedure.',
        validation,
      }
    }

    const engineGate = await checkEngineSignatureReadiness({
      procedureExecutionId: params.procedureExecutionId,
      organizationId: params.organizationId,
      responseSetId: validation.responseSetId,
      actorUserId: params.actorUserId,
    })
    if (engineGate.blocked && engineGate.message) {
      if (engineGate.snapshot) {
        await materializeEngineTasksAfterSignatureBlock({
          procedureExecutionId: params.procedureExecutionId,
          organizationId: params.organizationId,
          responseSetId: validation.responseSetId,
          actorUserId: params.actorUserId,
          snapshot: engineGate.snapshot,
        })
      }
      return {
        ok: false as const,
        error: engineGate.message,
        validation,
      }
    }
  }

  // Request the operational signature
  const req = await requestOperationalSignature({
    organizationId: params.organizationId,
    studyId: proc.study_id as string,
    subjectId: studySubjectId ?? '',
    visitId: proc.visit_id as string,
    artifactType: 'procedure_execution',
    artifactId: params.procedureExecutionId,
    requiredRole: 'coordinator', // For this iteration, we keep it generally generic based on earlier RBAC.
    signatureMeaning: 'I attest that the procedure data is accurate and complete.',
  })

  if (!req.ok || !req.requestId) return { ok: false as const, error: 'Failed to request signature.' }

  try {
    await requestProcedureSignatureLink({
      supabase: params.supabase,
      procedureExecutionId: params.procedureExecutionId,
      organizationId: params.organizationId,
      studyId: proc.study_id as string,
      visitId: proc.visit_id as string,
      subjectId: studySubjectId ?? '',
      actorUserId: params.actorUserId,
      requestId: req.requestId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not request procedure signature.'
    return {
      ok: false as const,
      error: coordinatorMessageFromError(new Error(message), {
        context: 'sign_procedure_request',
        fallbackMessage: message,
      }),
    }
  }

  return { ok: true as const, requestId: req.requestId, validation }
}

export async function completeProcedureSignature(params: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  actorUserId: string
  validation: ProcedureValidation
}) {
  const { data: proc } = await params.supabase
    .from('procedure_executions')
    .select('id, organization_id, signature_request_id, study_id, visit_id, visits!inner(study_subject_id), procedure_definitions(code, label)')
    .eq('id', params.procedureExecutionId)
    .eq('organization_id', params.organizationId)
    .single()

  if (!proc?.signature_request_id) return { ok: false as const, error: 'No signature request found.' }

  const { data: req } = await params.supabase
    .from('operational_signature_requests')
    .select('status, required_role')
    .eq('id', proc.signature_request_id)
    .single()

  if (req?.status !== 'signed') return { ok: false as const, error: 'Signature is not signed yet.' }

  // @ts-expect-error - PostgREST response shape is slightly tricky with inner joins
  const studySubjectId = proc.visits?.study_subject_id as string | undefined
  const procedureDefinition = Array.isArray(proc.procedure_definitions)
    ? proc.procedure_definitions[0]
    : proc.procedure_definitions
  const consent = await enforceConsentForProcedureExecution(
    {
      supabase: params.supabase,
      organizationId: params.organizationId,
      studyId: proc.study_id as string,
      subjectId: studySubjectId ?? '',
      visitId: proc.visit_id as string,
      procedureExecutionId: params.procedureExecutionId,
      actorUserId: params.actorUserId,
    },
    {
      code: typeof procedureDefinition?.code === 'string' ? procedureDefinition.code : null,
      label: typeof procedureDefinition?.label === 'string' ? procedureDefinition.label : null,
    },
  )
  if (!consent.ok) return { ok: false as const, error: consent.message }

  const signedAt = new Date().toISOString()
  const { data: signedRow, error } = await params.supabase
    .from('procedure_executions')
    .update({
      is_signed: true,
      signed_at: signedAt,
      signed_by: params.actorUserId,
      is_locked: true,
      execution_status: 'completed',
      validation_status: params.validation.status,
    })
    .eq('id', params.procedureExecutionId)
    .eq('organization_id', params.organizationId)
    .eq('is_signed', false)
    .select('id, signed_at, signed_by')
    .maybeSingle()

  if (error) {
    return {
      ok: false as const,
      error: coordinatorMessageFromError(error, {
        context: 'sign_procedure_update',
        fallbackMessage: 'Could not sign procedure. Refresh and try again.',
      }),
    }
  }
  if (!signedRow) {
    return {
      ok: true as const,
      idempotent: true as const,
    }
  }

  await logProcedureOperationalEvent({
    supabase: params.supabase,
    procedure: proc,
    actorUserId: params.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.PROCEDURE_SIGNED,
    payload: {
      response_set_id: params.validation.responseSetId,
      signed_at: signedAt,
      validation_status: params.validation.status,
    },
  })

  if (params.validation.responseSetId) {
    captureSourceSnapshotBestEffort({
      scope: {
        supabase: params.supabase,
        organizationId: params.organizationId,
        studyId: proc.study_id as string,
        studySubjectId: studySubjectId ?? null,
        visitId: proc.visit_id as string,
        procedureExecutionId: params.procedureExecutionId,
        sourceResponseSetId: params.validation.responseSetId,
        actorUserId: params.actorUserId,
      },
      snapshotType: SOURCE_SNAPSHOT_TYPE.SIGN,
    })
  }

  return { ok: true as const, validation: params.validation }
}
