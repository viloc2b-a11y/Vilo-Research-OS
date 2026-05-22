/**
 * Phase 5.0 — Source API error/warning builders and RPC normalization.
 */

import type {
  ApiError,
  ApiWarning,
  HardBlockCode,
  RpcEnvelope,
  WarningCode,
} from '@/lib/api/source/types'

const RPC_PREFIX_RE = /^([A-Z][A-Z0-9_]*):\s*([\s\S]*)$/

/** Map Postgres/RPC exception prefixes to API hard-block codes. */
const RPC_PREFIX_TO_HARD_CODE: Record<string, HardBlockCode> = {
  AUTH_REQUIRED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_INPUT: 'INVALID_REQUEST',
  ORGANIZATION_MISMATCH: 'TENANT_SCOPE_VIOLATION',
  NOT_FOUND: 'NOT_FOUND',
  SET_NOT_MUTABLE: 'SUBMITTED_VALUE_IMMUTABLE',
  VISIT_LOCKED: 'SUBMITTED_VALUE_IMMUTABLE',
  STALE_WRITE: 'STALE_WRITE',
  VALUE_TYPE_MISMATCH: 'VALUE_TYPE_INVALID',
  FIELD_ALREADY_CAPTURED: 'INVALID_REQUEST',
  ADDENDUM_FIELD_NOT_ON_APPLIED_MANIFEST: 'FIELD_BINDING_INVALID',
  SUBMIT_VALIDATION_FAILED: 'REQUIRED_FIELD_MISSING',
  LINEAGE_CONFLICT: 'LINEAGE_CONFLICT',
  DUPLICATE: 'LINEAGE_CONFLICT',
}

/** Map RPC `code` string from jsonb returns to API hard-block codes. */
const RPC_CODE_TO_HARD_CODE: Record<string, HardBlockCode> = {
  AUTH_REQUIRED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_INPUT: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'INVALID_REQUEST',
  SUBMIT_VALIDATION_FAILED: 'REQUIRED_FIELD_MISSING',
  ORGANIZATION_MISMATCH: 'TENANT_SCOPE_VIOLATION',
  NOT_FOUND: 'NOT_FOUND',
  VALUE_TYPE_MISMATCH: 'VALUE_TYPE_INVALID',
  SET_NOT_MUTABLE: 'SUBMITTED_VALUE_IMMUTABLE',
}

export function apiError(
  code: HardBlockCode | string,
  message: string,
  context?: ApiError['context'],
  field?: string | null,
  source: ApiError['source'] = 'api',
): ApiError {
  return {
    code,
    message,
    field: field ?? null,
    source,
    context: context ?? null,
  }
}

export function warning(
  code: WarningCode | string,
  message: string,
  context?: ApiWarning['context'],
  options?: { severity?: ApiWarning['severity']; field?: string | null; source?: ApiWarning['source'] },
): ApiWarning {
  return {
    code,
    message,
    severity: options?.severity ?? 'warning',
    field: options?.field ?? null,
    source: options?.source ?? 'api',
    context: context ?? null,
  }
}

function mapRpcItemToApiError(
  item: { code?: string; message?: string; field?: string; [key: string]: unknown },
  fallbackMessage: string,
): ApiError {
  const rpcCode = item.code ?? 'RPC_ERROR'
  const mapped = RPC_CODE_TO_HARD_CODE[rpcCode] ?? rpcCode
  return apiError(
    mapped,
    typeof item.message === 'string' && item.message.length > 0 ? item.message : fallbackMessage,
    { rpc_code: rpcCode, ...item },
    typeof item.field === 'string' ? item.field : null,
    'rpc',
  )
}

/**
 * Normalize Supabase client errors, Postgres exception strings, or unknown throws.
 * Does not hide RPC messages — preserves original text in `message` / `context`.
 */
export function normalizeRpcError(error: unknown): ApiError[] {
  if (error == null) {
    return [apiError('RPC_ERROR', 'Unknown RPC error', null, null, 'rpc')]
  }

  if (typeof error === 'string') {
    return [exceptionStringToApiError(error)]
  }

  if (typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string }
    const message = e.message ?? e.details ?? 'RPC call failed'
    const prefixMatch = message.match(RPC_PREFIX_RE)
    if (prefixMatch) {
      return [exceptionStringToApiError(message)]
    }
    const mapped = e.code ? RPC_CODE_TO_HARD_CODE[e.code] : undefined
    return [
      apiError(
        mapped ?? 'RPC_ERROR',
        message,
        { rpc_code: e.code, details: e.details, hint: e.hint },
        null,
        'rpc',
      ),
    ]
  }

  return [apiError('RPC_ERROR', String(error), null, null, 'rpc')]
}

function exceptionStringToApiError(message: string): ApiError {
  const match = message.match(RPC_PREFIX_RE)
  if (match) {
    const prefix = match[1]
    const detail = match[2]?.trim() || message
    const code = RPC_PREFIX_TO_HARD_CODE[prefix] ?? 'RPC_ERROR'
    return apiError(code, detail, { rpc_prefix: prefix, raw: message }, null, 'rpc')
  }
  return apiError('RPC_ERROR', message, { raw: message }, null, 'rpc')
}

/** Convert RPC jsonb `errors` array without dropping entries. */
export function rpcErrorsToApiErrors(
  rpc: RpcEnvelope,
  fallbackMessage = 'RPC returned an error',
): ApiError[] {
  if (Array.isArray(rpc.errors) && rpc.errors.length > 0) {
    return rpc.errors.map((item) =>
      mapRpcItemToApiError(item, typeof item.message === 'string' ? item.message : fallbackMessage),
    )
  }
  if (typeof rpc.error === 'string' && rpc.error.trim().length > 0) {
    return [exceptionStringToApiError(rpc.error)]
  }
  const code = typeof rpc.code === 'string' ? rpc.code : 'RPC_ERROR'
  const mapped = RPC_CODE_TO_HARD_CODE[code] ?? code
  return [apiError(mapped, fallbackMessage, { rpc_code: code }, null, 'rpc')]
}

export function resolveEnvelopeCode(
  ok: boolean,
  errors: ApiError[],
  explicitCode?: string,
): string {
  if (!ok) {
    if (explicitCode && explicitCode !== 'SUCCESS') return explicitCode
    return (errors[0]?.code as string) ?? 'ERROR'
  }
  return explicitCode ?? 'SUCCESS'
}

/** Suggested HTTP status for route handlers (mapping only — routes not implemented in 5.0). */
export function httpStatusForEnvelope(ok: boolean, code: string): number {
  if (ok) return 200
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
    case 'TENANT_SCOPE_VIOLATION':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'SUBMITTED_VALUE_IMMUTABLE':
    case 'LINEAGE_CONFLICT':
      return 409
    case 'INVALID_REQUEST':
      return 400
    case 'REQUIRED_FIELD_MISSING':
    case 'VALUE_TYPE_INVALID':
    case 'FIELD_BINDING_INVALID':
    case 'SOURCE_DEFINITION_UNPUBLISHED':
      return 422
    case 'INTERNAL_ERROR':
      return 500
    default:
      return 422
  }
}
