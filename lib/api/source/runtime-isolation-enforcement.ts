/**
 * Source API route runtime isolation — Phase 16E-1 enforcement helpers.
 */

import { apiError } from '@/lib/api/source/errors'
import { errorEnvelope } from '@/lib/api/source/envelope'
import { jsonEnvelope } from '@/lib/api/source/respond'
import type { SourceApiContext } from '@/lib/api/source/auth'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  classifyActorForOrganization,
  denyExternalReplayRead,
  RUNTIME_ISOLATION_CODE,
  RuntimeIsolationError,
  type RuntimeActorClassification,
} from '@/lib/external-access/runtime-isolation'

export type SourceIsolationResult =
  | { ok: true; actor: RuntimeActorClassification; mode: 'internal' | 'dto_only' }
  | { ok: false; response: ReturnType<typeof jsonEnvelope> }

function isolationErrorResponse(
  ctx: SourceApiContext,
  err: RuntimeIsolationError,
): ReturnType<typeof jsonEnvelope> {
  return jsonEnvelope(
    errorEnvelope(
      'FORBIDDEN',
      [
        apiError(
          'FORBIDDEN',
          err.message,
          { isolation_code: err.code },
          null,
          'api',
        ),
      ],
      { requestId: ctx.requestId },
    ),
    403,
  )
}

export async function resolveSourceRuntimeActor(
  ctx: SourceApiContext,
  organizationId: string,
): Promise<RuntimeActorClassification> {
  const memberships = await getOrganizationMemberships(ctx.user.id)
  return classifyActorForOrganization(memberships, organizationId)
}

export async function enforceInternalSourceRoute(
  ctx: SourceApiContext,
  organizationId: string,
): Promise<SourceIsolationResult> {
  try {
    const actor = await resolveSourceRuntimeActor(ctx, organizationId)
    if (actor.isExternalActor) {
      throw new RuntimeIsolationError(
        RUNTIME_ISOLATION_CODE.EXTERNAL_RUNTIME_DENIED,
        'External actors cannot access internal source runtime.',
      )
    }
    if (!actor.mayAccessInternalRuntime) {
      throw new RuntimeIsolationError(
        RUNTIME_ISOLATION_CODE.UNCERTAIN_ACTOR_DENIED,
        'Runtime access requires an explicit internal site role.',
      )
    }
    return { ok: true, actor, mode: 'internal' }
  } catch (err) {
    if (err instanceof RuntimeIsolationError) {
      return { ok: false, response: isolationErrorResponse(ctx, err) }
    }
    throw err
  }
}

export async function enforceSourceReadIsolation(
  ctx: SourceApiContext,
  organizationId: string,
): Promise<SourceIsolationResult> {
  try {
    const actor = await resolveSourceRuntimeActor(ctx, organizationId)
    if (actor.isExternalActor) {
      return { ok: true, actor, mode: 'dto_only' }
    }
    if (!actor.mayAccessInternalRuntime) {
      throw new RuntimeIsolationError(
        RUNTIME_ISOLATION_CODE.UNCERTAIN_ACTOR_DENIED,
        'Source read requires an explicit internal site role.',
      )
    }
    return { ok: true, actor, mode: 'internal' }
  } catch (err) {
    if (err instanceof RuntimeIsolationError) {
      return { ok: false, response: isolationErrorResponse(ctx, err) }
    }
    throw err
  }
}

export function enforceReplayRoute(
  ctx: SourceApiContext,
  actor: RuntimeActorClassification,
): SourceIsolationResult {
  try {
    denyExternalReplayRead(actor)
    return { ok: true, actor, mode: 'internal' }
  } catch (err) {
    if (err instanceof RuntimeIsolationError) {
      return { ok: false, response: isolationErrorResponse(ctx, err) }
    }
    throw err
  }
}
