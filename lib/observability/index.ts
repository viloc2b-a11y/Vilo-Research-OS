/**
 * OBS-1 / OBS-2 — Runtime observability.
 */

export {
  buildRuntimeTraceInsertPayload,
  toRuntimeTraceAuthorityColumns,
  validateRuntimeTraceAuthorityFields,
} from '@/lib/observability/build-trace-payload'

export {
  EXECUTION_SPAN_STATUS,
  EXECUTION_SPAN_STATUSES,
  EXECUTION_SPAN_TYPE,
  EXECUTION_SPAN_TYPES,
  OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS,
  RUNTIME_TRACE_STATUS,
  RUNTIME_TRACE_STATUSES,
  RUNTIME_TRACE_TYPE,
  RUNTIME_TRACE_TYPES,
  WORKFLOW_TELEMETRY_TYPE,
  WORKFLOW_TELEMETRY_TYPES,
  isExecutionSpanStatus,
  isExecutionSpanType,
  isRuntimeTraceStatus,
  isRuntimeTraceType,
  isWorkflowTelemetryType,
} from '@/lib/observability/constants'

export {
  OBS_COMPLIANCE_HOOK_SIGNALS,
  OBS_HOOK_SIGNAL,
} from '@/lib/observability/hook-signals'
export type {
  ObsComplianceHookSignal,
  ObsHookSignal,
} from '@/lib/observability/hook-signals'

export {
  assertTelemetryMetadataSafe,
  collectTelemetryMetadataIssues,
  redactTelemetryMetadata,
} from '@/lib/observability/redact-telemetry-metadata'

export { recordRuntimeTrace } from '@/lib/observability/record-runtime-trace'
export type { RecordRuntimeTraceInput } from '@/lib/observability/record-runtime-trace'

export { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
export type { RecordWorkflowTelemetryInput } from '@/lib/observability/record-workflow-telemetry'

export { safeObserve, safeObserveAwait } from '@/lib/observability/safe-observe'

export { resolveWorkflowKeyForClinicalMutation } from '@/lib/observability/resolve-clinical-mutation-workflow'

export { getObsWorkflowAuthorityDefault } from '@/lib/observability/workflow-authority-defaults'
export type { ObsWorkflowAuthoritySnapshot } from '@/lib/observability/workflow-authority-defaults'

export { observeClinicalMutationEmitted } from '@/lib/observability/hooks/observe-clinical-mutation'

export {
  observeBreakGlassAccessRequested,
  observeDelegationRuntimeChecked,
  observeTemporalConsistencyEvaluated,
} from '@/lib/observability/hooks/observe-compliance-guardrails'

export type {
  ExecutionSpanInsert,
  ExecutionSpanRecord,
  RuntimeTraceAuthorityFields,
  RuntimeTraceAuthorityValidationResult,
  RuntimeTraceInsert,
  RuntimeTraceRecord,
  WorkflowTelemetryEventInsert,
  WorkflowTelemetryEventRecord,
} from '@/lib/observability/types'

export type {
  ExecutionSpanStatus,
  ExecutionSpanType,
  RuntimeTraceStatus,
  RuntimeTraceType,
  WorkflowTelemetryType,
} from '@/lib/observability/constants'
