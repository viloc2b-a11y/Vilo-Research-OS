'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import { materializeInvoiceableLineItemsForVisit } from '@/lib/financial-runtime/invoiceable'
import type {
  CompleteProcedureResult,
  CompleteProcedureRpcPayload,
  CompleteProcedureValidationAlert,
} from '@/lib/actions/complete-procedure-execution.types'
import {
  coordinatorMessageFromError,
  coordinatorMessageFromRpcFailure,
} from '@/lib/runtime-errors'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

/**
 * JWT-only: calls `complete_procedure_execution` RPC (single transaction in Postgres).
 */
function mapValidationAlerts(
  alerts: { id: string; message: string; severity: string; fieldLabel?: string | null }[],
): CompleteProcedureValidationAlert[] {
  return alerts.map((alert) => ({
    id: alert.id,
    message: alert.message,
    severity: alert.severity === 'warning' ? 'warning' : 'blocked',
    fieldLabel: alert.fieldLabel ?? null,
  }))
}

export async function completeProcedureExecution(input: {
  procedureExecutionId: string
  revalidateVisitPath: string
  revalidateStudyPath: string
  revalidateSubjectPath: string
}): Promise<CompleteProcedureResult> {
  try {
    return await completeProcedureExecutionInner(input)
  } catch (err) {
    const translated = coordinatorMessageFromError(err, {
      context: 'complete_procedure_execution',
      fallbackMessage:
        'Could not complete the procedure. Resolve source validation blockers or try again.',
    })
    console.error('[completeProcedureExecution] unexpected failure', err)
    return { ok: false, message: translated }
  }
}

async function completeProcedureExecutionInner(input: {
  procedureExecutionId: string
  revalidateVisitPath: string
  revalidateStudyPath: string
  revalidateSubjectPath: string
}): Promise<CompleteProcedureResult> {
  const { procedureExecutionId, revalidateVisitPath, revalidateStudyPath, revalidateSubjectPath } =
    input

  if (!UUID_REGEX.test(procedureExecutionId)) {
    return { ok: false, message: 'Invalid procedure execution id.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user?.id) {
    return { ok: false, message: 'Authentication required.' }
  }

  const { data: proc, error: procErr } = await supabase
    .from('procedure_executions')
    .select('id, organization_id, section_disabled_at')
    .eq('id', procedureExecutionId)
    .maybeSingle()

  if (procErr) {
    return {
      ok: false,
      message: coordinatorMessageFromError(procErr, {
        context: 'complete_procedure_execution',
        fallbackMessage: 'Procedure execution not found.',
      }),
    }
  }
  if (!proc) return { ok: false, message: 'Procedure execution not found.' }
  if (proc.section_disabled_at) {
    return { ok: false, message: 'Procedure section is disabled and cannot be completed.' }
  }

  const validation = await validateProcedure({
    supabase,
    procedureExecutionId,
    organizationId: proc.organization_id as string,
  })

  const { error: statusUpdateErr } = await supabase
    .from('procedure_executions')
    .update({ validation_status: validation.status })
    .eq('id', procedureExecutionId)

  if (statusUpdateErr) {
    console.error('[completeProcedureExecution] validation_status update failed', statusUpdateErr.message)
  }

  if (validation.status === 'blocked' || validation.status === 'incomplete') {
    const alerts = mapValidationAlerts(validation.alerts)
    const summary =
      alerts.map((a) => a.message).join('; ') ||
      'Source validation must be resolved before marking complete.'
    return {
      ok: false,
      message: `Procedure completion blocked: ${summary}`,
      alerts,
    }
  }

  const { data: rawRpc, error: rpcErr } = await supabase.rpc('complete_procedure_execution', {
    p_procedure_execution_id: procedureExecutionId,
  })

  if (rpcErr) {
    return {
      ok: false,
      message: coordinatorMessageFromError(rpcErr, {
        context: 'complete_procedure_execution_rpc',
        fallbackMessage: 'Procedure completion failed.',
      }),
    }
  }

  const row = rawRpc as CompleteProcedureRpcPayload | null | undefined
  if (!row || typeof row !== 'object' || typeof row.ok !== 'boolean') {
    return { ok: false, message: 'Unexpected RPC response.' }
  }

  if (!row.ok) {
    const msg =
      typeof row.error === 'string' && row.error.trim().length > 0
        ? row.error
        : 'Procedure completion denied.'
    return {
      ok: false,
      message: coordinatorMessageFromRpcFailure(msg, 'Procedure completion denied.'),
    }
  }

  const idempotent = row.idempotent === true

  if (!idempotent) {
    void logAuditEvent({
      organizationId:
        typeof row.organization_id === 'string' ? row.organization_id : null,
      actorUserId: user.id,
      action: 'PROCEDURE_EXECUTION_COMPLETED',
      target: procedureExecutionId,
      metadata: {
        study_id: row.study_id,
        visit_id: row.visit_id,
      },
    })
  }

  if (typeof row.organization_id === 'string' && typeof row.study_id === 'string' && typeof row.visit_id === 'string') {
    try {
      const serviceSupabase = await createServiceClient()
      await materializeInvoiceableLineItemsForVisit({
        supabase: serviceSupabase,
        organizationId: row.organization_id,
        studyId: row.study_id,
        visitId: row.visit_id,
      })
    } catch (closureErr) {
      console.error('[completeProcedureExecution] invoiceable materialization failed', closureErr)
    }
  }

  revalidatePath(revalidateVisitPath)
  revalidatePath(revalidateStudyPath)
  revalidatePath(revalidateSubjectPath)
  revalidatePath('/studies')

  if (idempotent) {
    return { ok: true, idempotent: true }
  }
  return { ok: true }
}
