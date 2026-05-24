/**
 * Break-glass access validation (helper only — no global auth middleware).
 */

import { BREAK_GLASS_STATUS } from '@/lib/break-glass/constants'
import type { BreakGlassStatus } from '@/lib/break-glass/constants'
import type { BreakGlassAccessEventRecord } from '@/lib/break-glass/types'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const BREAK_GLASS_ACCESS_VALIDATION = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  INVALID: 'invalid',
} as const

export type BreakGlassAccessValidation =
  (typeof BREAK_GLASS_ACCESS_VALIDATION)[keyof typeof BREAK_GLASS_ACCESS_VALIDATION]

export type ValidateBreakGlassAccessInput = {
  status: BreakGlassStatus | string
  expiresAt: string | Date
  now?: Date
}

/**
 * Pure validation: active when status=active and expires_at > now.
 */
export function validateBreakGlassAccess(
  input: ValidateBreakGlassAccessInput,
): BreakGlassAccessValidation {
  const now = input.now ?? new Date()
  const expiresMs = new Date(input.expiresAt).getTime()
  if (Number.isNaN(expiresMs)) return BREAK_GLASS_ACCESS_VALIDATION.INVALID

  if (input.status !== BREAK_GLASS_STATUS.ACTIVE) {
    if (input.status === BREAK_GLASS_STATUS.EXPIRED) {
      return BREAK_GLASS_ACCESS_VALIDATION.EXPIRED
    }
    return BREAK_GLASS_ACCESS_VALIDATION.INVALID
  }

  if (expiresMs <= now.getTime()) {
    return BREAK_GLASS_ACCESS_VALIDATION.EXPIRED
  }

  return BREAK_GLASS_ACCESS_VALIDATION.ACTIVE
}

export type ValidateBreakGlassAccessAttemptInput = {
  supabase: SupabaseClient
  organizationId: string
  actorUserId: string
  event: Pick<
    BreakGlassAccessEventRecord,
    | 'id'
    | 'studyId'
    | 'visitId'
    | 'procedureExecutionId'
    | 'status'
    | 'expiresAt'
    | 'workflowKey'
  >
  now?: Date
}

export type ValidateBreakGlassAccessAttemptResult =
  | { ok: true; validation: typeof BREAK_GLASS_ACCESS_VALIDATION.ACTIVE }
  | {
      ok: false
      validation: typeof BREAK_GLASS_ACCESS_VALIDATION.EXPIRED | typeof BREAK_GLASS_ACCESS_VALIDATION.INVALID
      emittedExpiredAttempt: boolean
    }

/**
 * When expired access is attempted, emit BREAK_GLASS_EXPIRED_ACCESS_ATTEMPT (best-effort).
 */
export async function validateBreakGlassAccessAttempt(
  input: ValidateBreakGlassAccessAttemptInput,
): Promise<ValidateBreakGlassAccessAttemptResult> {
  const validation = validateBreakGlassAccess({
    status: input.event.status,
    expiresAt: input.event.expiresAt,
    now: input.now,
  })

  if (validation === BREAK_GLASS_ACCESS_VALIDATION.ACTIVE) {
    return { ok: true, validation }
  }

  let emittedExpiredAttempt = false
  if (validation === BREAK_GLASS_ACCESS_VALIDATION.EXPIRED && input.event.studyId) {
    try {
      await emitClinicalOperationalEvent({
        supabase: input.supabase as never,
        organizationId: input.organizationId,
        studyId: input.event.studyId,
        visitId: input.event.visitId,
        procedureExecutionId: input.event.procedureExecutionId,
        actorUserId: input.actorUserId,
        eventType: OPERATIONAL_EVENT_TYPES.BREAK_GLASS_EXPIRED_ACCESS_ATTEMPT,
        payloadSource: 'break-glass',
        mutation: 'break_glass.expired_access_attempt',
        details: {
          break_glass_event_id: input.event.id,
          workflow_key: input.event.workflowKey,
        },
      })
      emittedExpiredAttempt = true
    } catch {
      emittedExpiredAttempt = false
    }
  }

  return {
    ok: false,
    validation,
    emittedExpiredAttempt,
  }
}
