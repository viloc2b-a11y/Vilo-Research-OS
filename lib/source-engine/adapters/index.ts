/**
 * Phase 2 runtime adapters — bridge capture/procedure runtime ↔ source-engine Phase 1.
 *
 * Import via `@/lib/source-engine/adapters/index` (not `@/lib/source-engine/adapters`,
 * which resolves to legacy field-spec adapters in `adapters.ts`).
 */

export {
  captureFieldValueToEngineValue,
  mapApiResponsesToEngineResponses,
  mapCaptureFieldsToEngineResponses,
  mapEngineValidationToCaptureErrors,
  mapSourceResponsesToEngineResponses,
  type CaptureValidationError,
} from '@/lib/source-engine/adapters/source-response-adapter'

export {
  bridgeFromProcedureCaptureContext,
  bridgeFromProcedureCaptureRow,
  mapProcedureExecutionToRuntimeContext,
  type ProcedureCaptureBridge,
} from '@/lib/source-engine/adapters/procedure-runtime-adapter'

export {
  applyEngineRuntimeToCaptureFields,
  getProcedureDerivedValues,
  getSignaturePolicyForProcedure,
  resolveCaptureShellEngineRuntime,
  resolveProcedureSourceRuntime,
  validateProcedureSourceForSignature,
  validateProcedureSourceForSubmit,
  type ProcedureEngineRuntimeOptions,
  type ProcedureSourceEngineSnapshot,
  type SourceEngineSnapshotStatus,
} from '@/lib/source-engine/adapters/capture-runtime-adapter'

export {
  formatEngineSignatureBlockMessage,
  getSignatureBlockingErrors,
} from '@/lib/source-engine/adapters/signature-gate'

export type {
  SourceEngineProcedureRef,
  SourceEngineResolution,
  SourceEngineRuntimeConfig,
  TemplateResolutionSource,
} from '@/lib/source-engine/resolution/source-template-resolver'

export {
  resolveSourceEngineRuntimeConfig,
  resolveSourceEngineRuntimeConfigFromContext,
  getFallbackGenericTemplate,
} from '@/lib/source-engine/resolution/source-template-resolver'
