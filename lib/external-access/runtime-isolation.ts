/**
 * Phase 16E-1 — External runtime isolation enforcement (fail closed).
 */

import type { OrganizationMembership } from '@/lib/auth/session'
import { classifyRuntimeActor, type RuntimeActorClassification } from '@/lib/external-access/actor-classification'
import { assertCraCannotAccessInternalRuntime } from '@/lib/external-access/cra-access-policy'
import type { DeniedRuntimeTable } from '@/lib/external-access/denied-runtime-resources'
import {
  assertSourceReviewDtoHasNoInternalRuntimeFields,
  assertNoExternalRuntimeLeak,
  type SourceReviewDto,
} from '@/lib/external-access/source-review-dto'

export const RUNTIME_ISOLATION_CODE = {
  EXTERNAL_RUNTIME_DENIED: 'EXTERNAL_RUNTIME_DENIED',
  EXTERNAL_RAW_SOURCE_DENIED: 'EXTERNAL_RAW_SOURCE_DENIED',
  EXTERNAL_REPLAY_DENIED: 'EXTERNAL_REPLAY_DENIED',
  EXTERNAL_MUTATION_DENIED: 'EXTERNAL_MUTATION_DENIED',
  UNCERTAIN_ACTOR_DENIED: 'UNCERTAIN_ACTOR_DENIED',
  DTO_LEAKAGE_BLOCKED: 'DTO_LEAKAGE_BLOCKED',
  SOURCE_NOT_RELEASED: 'SOURCE_NOT_RELEASED',
} as const

export type RuntimeIsolationCode = (typeof RUNTIME_ISOLATION_CODE)[keyof typeof RUNTIME_ISOLATION_CODE]
export type { RuntimeActorClassification }

export class RuntimeIsolationError extends Error {
  readonly code: RuntimeIsolationCode

  constructor(code: RuntimeIsolationCode, message: string) {
    super(message)
    this.name = 'RuntimeIsolationError'
    this.code = code
  }
}

/** Response-set statuses external actors may view (submitted evidence only). */
export const EXTERNAL_RELEASED_RESPONSE_SET_STATUSES = new Set([
  'submitted',
  'signed',
  'locked',
  'reviewed',
])

export function classifyActorForOrganization(
  memberships: OrganizationMembership[],
  organizationId: string,
): RuntimeActorClassification {
  return classifyRuntimeActor(memberships, organizationId)
}

export function assertInternalRuntimeActor(
  actor: RuntimeActorClassification,
): void {
  if (actor.kind === 'uncertain') {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.UNCERTAIN_ACTOR_DENIED,
      'Runtime access requires an explicit internal site role.',
    )
  }
  if (!actor.mayAccessInternalRuntime) {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.EXTERNAL_RUNTIME_DENIED,
      'External actors cannot access internal runtime surfaces.',
    )
  }
}

export function assertExternalDtoOnlyResponse(dto: SourceReviewDto): void {
  const guard = assertNoExternalRuntimeLeak(dto)
  if (!guard.ok) {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.DTO_LEAKAGE_BLOCKED,
      `External DTO contains forbidden fields: ${guard.forbidden.join(', ')}`,
    )
  }
}

export function assertResponseSetStatusReleasableToExternal(status: string): void {
  if (!EXTERNAL_RELEASED_RESPONSE_SET_STATUSES.has(status.trim().toLowerCase())) {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.SOURCE_NOT_RELEASED,
      'Source review is not released for external review yet.',
    )
  }
}

export function denyExternalRawSourceRead(actor: RuntimeActorClassification): void {
  if (actor.isExternalActor || actor.kind === 'uncertain') {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.EXTERNAL_RAW_SOURCE_DENIED,
      'External actors may only receive approved source review DTO projections.',
    )
  }
  assertInternalRuntimeActor(actor)
}

export function denyExternalReplayRead(actor: RuntimeActorClassification): void {
  if (actor.isExternalActor || actor.kind === 'uncertain') {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.EXTERNAL_REPLAY_DENIED,
      'Manifest, history, and replay chronology are site-internal only.',
    )
  }
  assertInternalRuntimeActor(actor)
}

export function denyExternalSourceMutation(actor: RuntimeActorClassification): void {
  if (actor.isExternalActor || actor.kind === 'uncertain' || !actor.mayAccessInternalRuntime) {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.EXTERNAL_MUTATION_DENIED,
      'External actors have read-only access to released source review DTOs.',
    )
  }
}

export function assertRuntimeProjectionQueryAllowed(
  table: DeniedRuntimeTable | string,
  actor: RuntimeActorClassification,
): void {
  if (actor.mayAccessInternalRuntime && !actor.isExternalActor) return

  const violation = assertCraCannotAccessInternalRuntime(table)
  if (violation) {
    throw new RuntimeIsolationError(
      RUNTIME_ISOLATION_CODE.EXTERNAL_RUNTIME_DENIED,
      violation.message,
    )
  }
}
