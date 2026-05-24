'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import type { VisitLifecycleResult, VisitLifecycleRpcPayload } from '@/lib/actions/visit-lifecycle.types'
import { coordinatorMessageFromError, coordinatorMessageFromRpcFailure } from '@/lib/runtime-errors'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

export async function lockVisit(input: {
  visitId: string
  visitPath: string
  studyPath: string
  subjectPath: string
}): Promise<VisitLifecycleResult> {
  const { visitId, visitPath, studyPath, subjectPath } = input
  if (!UUID_REGEX.test(visitId)) {
    return { ok: false, message: 'Invalid visit id.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user?.id) {
    return { ok: false, message: 'Authentication required.' }
  }

  const { data: rawRpc, error: rpcErr } = await supabase.rpc('lock_visit', {
    p_visit_id: visitId,
  })
  if (rpcErr) {
    return {
      ok: false,
      message: coordinatorMessageFromError(rpcErr, {
        context: 'lock_visit',
        fallbackMessage: 'Visit lock failed. Try again or contact support.',
      }),
    }
  }

  const row = rawRpc as VisitLifecycleRpcPayload | null | undefined
  if (!row || typeof row !== 'object' || typeof row.ok !== 'boolean') {
    return { ok: false, message: 'Unexpected RPC response.' }
  }
  if (!row.ok) {
    const msg =
      typeof row.error === 'string' && row.error.trim().length > 0
        ? row.error
        : 'Visit lock denied.'
    return {
      ok: false,
      message: coordinatorMessageFromRpcFailure(msg, 'Visit lock denied.'),
    }
  }

  const idempotent = row.idempotent === true
  const org =
    typeof row.organization_id === 'string' ? row.organization_id : null

  if (!idempotent) {
    void logAuditEvent({
      organizationId: org,
      actorUserId: user.id,
      action: 'VISIT_LOCKED',
      target: visitId,
      metadata: {
        operational_event_id: row.operational_event_id ?? null,
        study_id: row.study_id,
      },
    })
  }

  // H5 Phase 4: Generate immutable eCRF/PDF snapshots on successful lock
  if (!idempotent && row.ok) {
    const { snapshotVisitProcedures } = await import('@/lib/visit-runtime/snapshotVisit')
    // Dispatch in background so we don't block the UI heavily, or await it if preferred.
    // The prompt says "generate immutable snapshot artifact on lock workflow".
    // We await it to ensure it completes before revalidating, giving immediate feedback.
    await snapshotVisitProcedures(visitId, user.id)
  }

  revalidatePath(visitPath)
  revalidatePath(studyPath)
  revalidatePath(subjectPath)
  revalidatePath('/studies')

  if (idempotent) return { ok: true, idempotent: true }
  return { ok: true }
}
