/**
 * Phase 16A-2.5 — Delegation runtime check constants.
 */

export const DELEGATION_CHECK_RESULT = {
  DELEGATED: 'delegated',
  NOT_DELEGATED: 'not_delegated',
  UNKNOWN: 'unknown',
} as const

export const DELEGATION_CHECK_RESULTS = [
  DELEGATION_CHECK_RESULT.DELEGATED,
  DELEGATION_CHECK_RESULT.NOT_DELEGATED,
  DELEGATION_CHECK_RESULT.UNKNOWN,
] as const

export type DelegationCheckResult = (typeof DELEGATION_CHECK_RESULTS)[number]

export const DELEGATION_RUNTIME_OUTCOME = {
  DELEGATED: 'delegated',
  WARNING: 'warning',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
} as const

export type DelegationRuntimeOutcome =
  (typeof DELEGATION_RUNTIME_OUTCOME)[keyof typeof DELEGATION_RUNTIME_OUTCOME]
