/**
 * Coordinator-facing runtime error wiring (API envelopes + server actions).
 * Preserves technical detail in logs/context; never exposes SQL/PHI to coordinators.
 */

import { apiError } from '@/lib/api/source/errors'
import type { ApiError } from '@/lib/api/source/types'
import { isStaleWriteError, STALE_WRITE_USER_MESSAGE } from '@/lib/concurrency/stale-write'
import {
  RUNTIME_ERROR_CODE,
  translateRuntimeError,
  type TranslatedRuntimeError,
} from '@/lib/runtime-errors/translate-runtime-error'

export type CoordinatorFacingErrorOptions = {
  context?: string
  fallbackMessage?: string
  /** When set, prefer this API hard-block code over runtime code mapping. */
  hardBlockCode?: string
  field?: string | null
  source?: ApiError['source']
}

/** Log technical detail for replay/debug — not shown to coordinators. */
export function logCoordinatorRuntimeError(
  scope: string,
  error: unknown,
  translated?: TranslatedRuntimeError,
): void {
  const t = translated ?? translateRuntimeError({ error, context: scope })
  console.error(`[coordinator-runtime:${scope}]`, {
    code: t.code,
    technicalMessage: t.technicalMessage,
    retryable: t.retryable,
    suggestedAction: t.suggestedAction,
    error,
  })
}

function legacyDomainCoordinatorMessage(technicalMessage: string, fallback: string): string | null {
  const msgLower = technicalMessage.toLowerCase()

  if (msgLower.includes('is terminal and cannot be changed')) {
    const match = technicalMessage.match(/visit_status (\w+) is terminal/i)
    const status = match ? match[1] : 'terminal'
    return `Cannot modify: the visit is in a locked or terminal (${status}) state.`
  }

  if (
    msgLower.includes('cannot delete')
    || msgLower.includes('violates foreign key constraint')
    || msgLower.includes('delete_guard')
  ) {
    if (msgLower.includes('visit') || msgLower.includes('visits')) {
      return 'Cannot delete: active visits exist and must be cancelled instead.'
    }
    if (msgLower.includes('procedure_execution')) {
      return 'Cannot delete: this procedure is no longer pending.'
    }
    if (msgLower.includes('source_response')) {
      return 'Cannot delete: source responses have been submitted. Use data corrections instead.'
    }
    if (msgLower.includes('visit_progress_notes')) {
      return 'Cannot delete: progress notes have been signed.'
    }
    return 'This record cannot be physically deleted due to runtime clinical constraints.'
  }

  if (msgLower.includes('operational events are strictly append-only')) {
    return 'Audit events are immutable and cannot be modified.'
  }

  if (msgLower.includes('source locked') || (msgLower.includes('submitted') && !msgLower.includes('before'))) {
    return 'Cannot edit: this source material is already submitted or locked.'
  }

  if (
    msgLower.includes('unblinded')
    || (msgLower.includes('permission') && !msgLower.includes('row-level'))
  ) {
    return 'You do not have the required permissions or unblinded access to perform this action.'
  }

  return null
}

/**
 * Translate runtime errors and apply legacy domain-specific coordinator messages where needed.
 */
export function translateCoordinatorFacingError(
  error: unknown,
  options?: CoordinatorFacingErrorOptions,
): TranslatedRuntimeError {
  const technical =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error)

  if (isStaleWriteError(technical)) {
    return {
      code: RUNTIME_ERROR_CODE.STALE_OCC_VERSION,
      severity: 'warning',
      coordinatorMessage: STALE_WRITE_USER_MESSAGE,
      technicalMessage: technical,
      retryable: true,
      suggestedAction: 'refresh_and_retry',
    }
  }

  const translated = translateRuntimeError({ error, context: options?.context })

  const legacy = legacyDomainCoordinatorMessage(
    translated.technicalMessage,
    options?.fallbackMessage ?? translated.coordinatorMessage,
  )
  if (legacy) {
    return { ...translated, coordinatorMessage: legacy }
  }

  if (
    translated.code === RUNTIME_ERROR_CODE.GENERIC_RUNTIME
    && options?.fallbackMessage
    && options.fallbackMessage !== translated.coordinatorMessage
  ) {
    return { ...translated, coordinatorMessage: options.fallbackMessage }
  }

  return translated
}

export function coordinatorMessageFromError(
  error: unknown,
  options?: CoordinatorFacingErrorOptions,
): string {
  return translateCoordinatorFacingError(error, options).coordinatorMessage
}

export function coordinatorMessageFromRpcFailure(
  rpcError: string | null | undefined,
  fallbackMessage: string,
): string {
  if (!rpcError || !rpcError.trim()) return fallbackMessage
  return coordinatorMessageFromError(new Error(rpcError), { fallbackMessage })
}

export function runtimeErrorCodeToHardBlockCode(
  runtimeCode: string,
  explicit?: string,
): string {
  if (explicit) return explicit
  switch (runtimeCode) {
    case RUNTIME_ERROR_CODE.UNIQUE_CONSTRAINT:
      return 'LINEAGE_CONFLICT'
    case RUNTIME_ERROR_CODE.RLS_DENIED:
    case RUNTIME_ERROR_CODE.STUDY_ACCESS_DENIED:
      return 'FORBIDDEN'
    case RUNTIME_ERROR_CODE.IMMUTABLE_SNAPSHOT:
    case RUNTIME_ERROR_CODE.RESPONSE_SET_ALREADY_SUBMITTED:
      return 'SUBMITTED_VALUE_IMMUTABLE'
    case RUNTIME_ERROR_CODE.STALE_OCC_VERSION:
      return 'STALE_WRITE'
    case RUNTIME_ERROR_CODE.RESPONSE_SET_MISSING:
      return 'NOT_FOUND'
    case RUNTIME_ERROR_CODE.BREAK_GLASS_EXPIRED:
      return 'FORBIDDEN'
    default:
      return 'RPC_ERROR'
  }
}

export function apiErrorFromRuntimeError(
  error: unknown,
  options?: CoordinatorFacingErrorOptions,
): ApiError {
  const translated = translateCoordinatorFacingError(error, options)
  logCoordinatorRuntimeError(options?.context ?? 'source-api', error, translated)
  const code = runtimeErrorCodeToHardBlockCode(
    translated.code,
    options?.hardBlockCode,
  )
  return apiError(
    code,
    translated.coordinatorMessage,
    {
      runtime_error_code: translated.code,
      technical_message: translated.technicalMessage,
      retryable: translated.retryable,
      suggested_action: translated.suggestedAction,
    },
    options?.field ?? null,
    options?.source ?? 'rpc',
  )
}
