/**
 * OBS-1 / OBS-2 — Runtime observability schema types.
 */

import type {
  EffectiveAuthorityLevel,
  WorkflowAuthorityLevel,
  WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'
import type {
  ExecutionSpanStatus,
  ExecutionSpanType,
  RuntimeTraceStatus,
  RuntimeTraceType,
  WorkflowTelemetryType,
} from '@/lib/observability/constants'

/** OBS-2 governed authority fields on runtime_traces (enum columns only). */
export type RuntimeTraceAuthorityFields = {
  workflowKey: WorkflowKey | null
  baseAuthorityLevel: WorkflowAuthorityLevel | null
  effectiveAuthorityLevel: EffectiveAuthorityLevel | null
}

export type RuntimeTraceRecord = {
  id: string
  organizationId: string
  studyId: string | null
  studySubjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  workflowKey: WorkflowKey | null
  baseAuthorityLevel: WorkflowAuthorityLevel | null
  effectiveAuthorityLevel: EffectiveAuthorityLevel | null
  traceType: RuntimeTraceType
  status: RuntimeTraceStatus
  actorUserId: string | null
  sourceOperationalEventId: string | null
  metadata: Record<string, unknown>
  startedAt: string
  endedAt: string | null
  createdAt: string
}

export type ExecutionSpanRecord = {
  id: string
  runtimeTraceId: string | null
  organizationId: string
  studyId: string | null
  studySubjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  spanType: ExecutionSpanType
  status: ExecutionSpanStatus
  actorUserId: string | null
  dependencyRefs: unknown[]
  blockerRefs: unknown[]
  warningRefs: unknown[]
  aiParticipation: boolean
  metadata: Record<string, unknown>
  startedAt: string
  endedAt: string | null
  createdAt: string
}

export type WorkflowTelemetryEventRecord = {
  id: string
  organizationId: string
  runtimeTraceId: string | null
  workflowKey: WorkflowKey | null
  telemetryType: WorkflowTelemetryType
  actorUserId: string | null
  studyId: string | null
  studySubjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type RuntimeTraceInsert = {
  organizationId: string
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  traceType: RuntimeTraceType
  status: RuntimeTraceStatus
  actorUserId?: string | null
  sourceOperationalEventId?: string | null
  metadata?: Record<string, unknown>
  startedAt?: string
  endedAt?: string | null
} & RuntimeTraceAuthorityFields

export type ExecutionSpanInsert = {
  runtimeTraceId?: string | null
  organizationId: string
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  spanType: ExecutionSpanType
  status: ExecutionSpanStatus
  actorUserId?: string | null
  dependencyRefs?: unknown[]
  blockerRefs?: unknown[]
  warningRefs?: unknown[]
  aiParticipation?: boolean
  metadata?: Record<string, unknown>
  startedAt?: string
  endedAt?: string | null
}

export type WorkflowTelemetryEventInsert = {
  organizationId: string
  runtimeTraceId?: string | null
  workflowKey?: WorkflowKey | null
  telemetryType: WorkflowTelemetryType
  actorUserId?: string | null
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  metadata?: Record<string, unknown>
}

export type RuntimeTraceAuthorityValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }
