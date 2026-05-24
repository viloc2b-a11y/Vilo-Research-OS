/**
 * Phase 16A-2.7 — Coordinator-safe runtime error translation.
 */

export {
  RUNTIME_ERROR_CODE,
  RUNTIME_ERROR_SEVERITY,
  translateRuntimeError,
} from '@/lib/runtime-errors/translate-runtime-error'

export type {
  RuntimeErrorCode,
  RuntimeErrorSeverity,
  TranslatedRuntimeError,
  TranslateRuntimeErrorInput,
} from '@/lib/runtime-errors/translate-runtime-error'

export {
  apiErrorFromRuntimeError,
  coordinatorMessageFromError,
  coordinatorMessageFromRpcFailure,
  logCoordinatorRuntimeError,
  runtimeErrorCodeToHardBlockCode,
  translateCoordinatorFacingError,
} from '@/lib/runtime-errors/coordinator-facing'

export type { CoordinatorFacingErrorOptions } from '@/lib/runtime-errors/coordinator-facing'
