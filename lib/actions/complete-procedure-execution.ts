'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import type {
  CompleteProcedureResult,
  CompleteProcedureRpcPayload,
} from '@/lib/actions/complete-procedure-execution.types'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

/**
 * JWT-only: calls `complete_procedure_execution` RPC (single transaction in Postgres).
 */
export async function completeProcedureExecution(input: {
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

  const { data: rawRpc, error: rpcErr } = await supabase.rpc('complete_procedure_execution', {
    p_procedure_execution_id: procedureExecutionId,
  })

  if (rpcErr) {
    return { ok: false, message: rpcErr.message }
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
    return { ok: false, message: msg }
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

  revalidatePath(revalidateVisitPath)
  revalidatePath(revalidateStudyPath)
  revalidatePath(revalidateSubjectPath)
  revalidatePath('/studies')

  if (idempotent) {
    return { ok: true, idempotent: true }
  }
  return { ok: true }
}
