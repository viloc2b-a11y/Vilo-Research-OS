/**
 * Coordinator-safe runtime error translation (no SQL, table names, or PHI in coordinatorMessage).
 */

export const RUNTIME_ERROR_CODE = {
  UNIQUE_CONSTRAINT: 'UNIQUE_CONSTRAINT',
  RLS_DENIED: 'RLS_DENIED',
  STUDY_ACCESS_DENIED: 'STUDY_ACCESS_DENIED',
  IMMUTABLE_SNAPSHOT: 'IMMUTABLE_SNAPSHOT',
  STALE_OCC_VERSION: 'STALE_OCC_VERSION',
  RESPONSE_SET_MISSING: 'RESPONSE_SET_MISSING',
  RESPONSE_SET_ALREADY_SUBMITTED: 'RESPONSE_SET_ALREADY_SUBMITTED',
  BREAK_GLASS_EXPIRED: 'BREAK_GLASS_EXPIRED',
  GENERIC_RUNTIME: 'GENERIC_RUNTIME',
} as const

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODE)[keyof typeof RUNTIME_ERROR_CODE]

export const RUNTIME_ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const

export type RuntimeErrorSeverity =
  (typeof RUNTIME_ERROR_SEVERITY)[keyof typeof RUNTIME_ERROR_SEVERITY]

export type TranslatedRuntimeError = {
  code: RuntimeErrorCode
  severity: RuntimeErrorSeverity
  coordinatorMessage: string
  technicalMessage: string
  retryable: boolean
  suggestedAction: string | null
}

export type TranslateRuntimeErrorInput = {
  error: unknown
  /** Optional domain hint (e.g. submit, sign, snapshot). */
  context?: string
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message
    return typeof msg === 'string' ? msg : String(msg)
  }
  return String(error)
}

function extractCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase()
  return needles.some((n) => lower.includes(n.toLowerCase()))
}

export function translateRuntimeError(
  input: TranslateRuntimeErrorInput,
): TranslatedRuntimeError {
  const technicalMessage = extractMessage(input.error)
  const pgCode = extractCode(input.error)
  const lower = technicalMessage.toLowerCase()

  if (
    pgCode === '23505' ||
    includesAny(lower, ['duplicate key', 'unique constraint', 'already exists'])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.UNIQUE_CONSTRAINT,
      severity: RUNTIME_ERROR_SEVERITY.WARNING,
      coordinatorMessage:
        'This action conflicts with data already on record. Refresh the visit and try again.',
      technicalMessage,
      retryable: true,
      suggestedAction: 'refresh_and_retry',
    }
  }

  if (
    pgCode === '42501' ||
    includesAny(lower, [
      'row-level security',
      'permission denied',
      'rls',
      'not authorized',
      'insufficient privilege',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.RLS_DENIED,
      severity: RUNTIME_ERROR_SEVERITY.ERROR,
      coordinatorMessage:
        'You do not have permission to perform this action for this study or visit.',
      technicalMessage,
      retryable: false,
      suggestedAction: 'contact_study_admin',
    }
  }

  if (
    includesAny(lower, [
      'study access',
      'user_has_study_access',
      'not a member',
      'no study access',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.STUDY_ACCESS_DENIED,
      severity: RUNTIME_ERROR_SEVERITY.ERROR,
      coordinatorMessage: 'You do not have access to this study.',
      technicalMessage,
      retryable: false,
      suggestedAction: 'request_study_access',
    }
  }

  if (
    includesAny(lower, [
      'block_source_snapshot',
      'source_response_field_snapshots',
      'immutable snapshot',
      'snapshot is immutable',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.IMMUTABLE_SNAPSHOT,
      severity: RUNTIME_ERROR_SEVERITY.ERROR,
      coordinatorMessage:
        'Source integrity snapshots cannot be changed after capture. Start a correction workflow if needed.',
      technicalMessage,
      retryable: false,
      suggestedAction: 'use_correction_workflow',
    }
  }

  if (
    includesAny(lower, [
      'stale',
      'occ',
      'version conflict',
      'optimistic',
      'row was updated',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.STALE_OCC_VERSION,
      severity: RUNTIME_ERROR_SEVERITY.WARNING,
      coordinatorMessage:
        'This record was updated elsewhere. Refresh the page and re-enter your changes.',
      technicalMessage,
      retryable: true,
      suggestedAction: 'refresh_and_retry',
    }
  }

  if (
    includesAny(lower, [
      'response set not found',
      'no response set',
      'missing response set',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.RESPONSE_SET_MISSING,
      severity: RUNTIME_ERROR_SEVERITY.ERROR,
      coordinatorMessage: 'Source data for this procedure is not available yet.',
      technicalMessage,
      retryable: true,
      suggestedAction: 'reload_visit',
    }
  }

  if (
    includesAny(lower, [
      'already submitted',
      'submitted_value_immutable',
      'response set submitted',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.RESPONSE_SET_ALREADY_SUBMITTED,
      severity: RUNTIME_ERROR_SEVERITY.WARNING,
      coordinatorMessage:
        'This source form is already submitted. Use correction or addendum workflows to make changes.',
      technicalMessage,
      retryable: false,
      suggestedAction: 'use_correction_workflow',
    }
  }

  if (
    includesAny(lower, [
      'break_glass',
      'break glass',
      'expired access',
      'access has expired',
    ])
  ) {
    return {
      code: RUNTIME_ERROR_CODE.BREAK_GLASS_EXPIRED,
      severity: RUNTIME_ERROR_SEVERITY.ERROR,
      coordinatorMessage: 'Emergency access expired. Request a new approval.',
      technicalMessage,
      retryable: false,
      suggestedAction: 'request_break_glass',
    }
  }

  return {
    code: RUNTIME_ERROR_CODE.GENERIC_RUNTIME,
    severity: RUNTIME_ERROR_SEVERITY.ERROR,
    coordinatorMessage:
      'Something went wrong while processing your request. Try again or contact support if it continues.',
    technicalMessage,
    retryable: true,
    suggestedAction: 'retry_or_contact_support',
  }
}
