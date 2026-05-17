/**
 * Phase 5.0 — Source API response envelope builders.
 */

import {
  apiError,
  normalizeRpcError,
  resolveEnvelopeCode,
  rpcErrorsToApiErrors,
} from '@/lib/api/source/errors'
import type {
  ApiEnvelope,
  ApiError,
  ApiWarning,
  EnvelopeBuildOptions,
  RpcEnvelope,
} from '@/lib/api/source/types'

export type { ApiEnvelope, ApiError, ApiWarning } from '@/lib/api/source/types'
export { apiError, warning, normalizeRpcError } from '@/lib/api/source/errors'

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function buildMeta(
  errors: ApiError[],
  warnings: ApiWarning[],
  options?: EnvelopeBuildOptions,
): ApiEnvelope<unknown>['meta'] {
  return {
    requestId: options?.requestId ?? newRequestId(),
    timestamp: new Date().toISOString(),
    source: 'api',
    rpc: options?.rpc,
    hardBlockCount: errors.length,
    warningCount: warnings.length,
  }
}

/**
 * Success envelope. Warnings never set `ok` to false.
 */
export function okEnvelope<T>(data: T, options?: EnvelopeBuildOptions): ApiEnvelope<T> {
  const warnings = options?.warnings ?? []
  const errors: ApiError[] = []
  return {
    ok: true,
    code: options?.code ?? 'SUCCESS',
    data,
    errors,
    warnings,
    meta: buildMeta(errors, warnings, options),
  }
}

/**
 * Failure envelope — `ok` is always false when `errors` is non-empty.
 */
export function errorEnvelope(
  code: string,
  errors: ApiError[],
  options?: EnvelopeBuildOptions & { data?: null },
): ApiEnvelope<null> {
  const warnings = options?.warnings ?? []
  const normalizedErrors = errors.length > 0 ? errors : [apiError(code, 'Request failed')]
  return {
    ok: false,
    code: resolveEnvelopeCode(false, normalizedErrors, code),
    data: options?.data ?? null,
    errors: normalizedErrors,
    warnings,
    meta: buildMeta(normalizedErrors, warnings, options),
  }
}

/**
 * Map Phase 4B/4C RPC jsonb (or Supabase throw) into the standard API envelope.
 * Passes through RPC `errors[]`; does not hide messages.
 */
export function fromRpcEnvelope<T>(
  rpcResult: RpcEnvelope<T> | T | null | undefined,
  options?: EnvelopeBuildOptions,
): ApiEnvelope<T | null> {
  const warnings = options?.warnings ?? []

  if (rpcResult == null) {
    return errorEnvelope('RPC_ERROR', [apiError('RPC_ERROR', 'Empty RPC response', null, null, 'rpc')], {
      ...options,
      warnings,
    })
  }

  if (typeof rpcResult !== 'object' || !('ok' in rpcResult)) {
    return okEnvelope(rpcResult as T, { ...options, warnings })
  }

  const rpc = rpcResult as RpcEnvelope<T>

  if (rpc.ok === true) {
    const data = (rpc.data ?? null) as T | null
    const rpcWarnings = Array.isArray(rpc.warnings) ? rpc.warnings : []
    return {
      ok: true,
      code: typeof rpc.code === 'string' ? rpc.code : 'SUCCESS',
      data,
      errors: [],
      warnings: [...warnings, ...rpcWarnings],
      meta: buildMeta([], [...warnings, ...rpcWarnings], options),
    }
  }

  if (rpc.ok === false) {
    const errors = rpcErrorsToApiErrors(rpc)
    const rpcWarnings = Array.isArray(rpc.warnings) ? rpc.warnings : []
    return {
      ok: false,
      code: resolveEnvelopeCode(false, errors, typeof rpc.code === 'string' ? rpc.code : undefined),
      data: null,
      errors,
      warnings: [...warnings, ...rpcWarnings],
      meta: buildMeta(errors, [...warnings, ...rpcWarnings], options),
    }
  }

  return okEnvelope((rpc.data ?? rpcResult) as T, {
    ...options,
    warnings,
    code: typeof rpc.code === 'string' ? rpc.code : 'SUCCESS',
  })
}

/**
 * Build envelope from a thrown Supabase/Postgres error (route catch blocks).
 */
export function fromRpcThrown(error: unknown, options?: EnvelopeBuildOptions): ApiEnvelope<null> {
  const errors = normalizeRpcError(error)
  return errorEnvelope(errors[0]?.code ?? 'RPC_ERROR', errors, options)
}
