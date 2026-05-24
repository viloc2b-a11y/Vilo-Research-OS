/**
 * OBS-2 — Pilot audit integrity telemetry (best-effort; non-blocking).
 */

import {
  WORKFLOW_KEY,
  type WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'
import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { redactTelemetryMetadata } from '@/lib/observability/redact-telemetry-metadata'
import { safeObserve } from '@/lib/observability/safe-observe'
import { getObsWorkflowAuthorityDefault } from '@/lib/observability/workflow-authority-defaults'
import type { RoleConflictResolution, RoleConflictType } from '@/lib/role-conflicts/constants'
import type { SourceSnapshotType } from '@/lib/source/integrity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export function observeSourceFieldSnapshotCaptured(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  sourceResponseSetId: string
  snapshotType: SourceSnapshotType
  capturedCount: number
  visitId?: string | null
  procedureExecutionId?: string | null
  actorUserId: string
}): void {
  safeObserve(OBS_HOOK_SIGNAL.SOURCE_FIELD_SNAPSHOT_CAPTURED, async () => {
    const authority = getObsWorkflowAuthorityDefault(WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT)

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.SOURCE_FIELD_SNAPSHOT_CAPTURED,
      workflowKey: WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT,
      actorUserId: input.actorUserId,
      studyId: input.studyId,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      metadata: redactTelemetryMetadata({
        source_response_set_id: input.sourceResponseSetId,
        snapshot_type: input.snapshotType,
        captured_count: input.capturedCount,
        base_authority_level: authority.baseAuthorityLevel,
        effective_authority_level: authority.effectiveAuthorityLevel,
      }),
    })
  })
}

export function observeSourceIntegrityViolationDetected(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  sourceResponseSetId: string
  snapshotType: SourceSnapshotType
  mismatchCount: number
  missingCount: number
  operationalEventId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  actorUserId: string
}): void {
  safeObserve(OBS_HOOK_SIGNAL.SOURCE_INTEGRITY_VIOLATION_DETECTED, async () => {
    const authority = getObsWorkflowAuthorityDefault(WORKFLOW_KEY.SOURCE_INTEGRITY_VIOLATION)

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.SOURCE_INTEGRITY_VIOLATION_DETECTED,
      workflowKey: WORKFLOW_KEY.SOURCE_INTEGRITY_VIOLATION,
      actorUserId: input.actorUserId,
      studyId: input.studyId,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      metadata: redactTelemetryMetadata({
        source_response_set_id: input.sourceResponseSetId,
        snapshot_type: input.snapshotType,
        mismatch_count: input.mismatchCount,
        missing_count: input.missingCount,
        operational_event_id: input.operationalEventId ?? null,
        base_authority_level: authority.baseAuthorityLevel,
        effective_authority_level: authority.effectiveAuthorityLevel,
      }),
    })
  })
}

export function observeWorkflowStaleAlert(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  workflowKey: WorkflowKey
  checkpointId: string
  staleEventId: string
  operationalEventId?: string | null
  staleAgeHours: number
  thresholdHours: number
}): void {
  safeObserve(OBS_HOOK_SIGNAL.WORKFLOW_STALE_ALERT, async () => {
    const authority = getObsWorkflowAuthorityDefault(WORKFLOW_KEY.WORKFLOW_ABANDONMENT_REVIEW)

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.WORKFLOW_STALE_ALERT,
      workflowKey: WORKFLOW_KEY.WORKFLOW_ABANDONMENT_REVIEW,
      studyId: input.studyId ?? undefined,
      studySubjectId: input.studySubjectId ?? null,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      metadata: redactTelemetryMetadata({
        workflow_checkpoint_id: input.checkpointId,
        workflow_stale_event_id: input.staleEventId,
        operational_event_id: input.operationalEventId ?? null,
        stale_age_hours: input.staleAgeHours,
        threshold_hours: input.thresholdHours,
        stale_source_workflow_key: input.workflowKey,
        base_authority_level: authority.baseAuthorityLevel,
        effective_authority_level: authority.effectiveAuthorityLevel,
      }),
    })
  })
}

export function observeRoleConflictDetected(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId?: string | null
  actorUserId: string
  workflowKey: WorkflowKey
  conflictType: RoleConflictType
  resolution: RoleConflictResolution
  eventId: string
  operationalEventId?: string | null
  actionAttempted: string
}): void {
  safeObserve(OBS_HOOK_SIGNAL.ROLE_CONFLICT_DETECTED, async () => {
    const authority = getObsWorkflowAuthorityDefault(WORKFLOW_KEY.ROLE_CONFLICT_RESOLUTION)

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.ROLE_CONFLICT_DETECTED,
      workflowKey: WORKFLOW_KEY.ROLE_CONFLICT_RESOLUTION,
      actorUserId: input.actorUserId,
      studyId: input.studyId ?? undefined,
      metadata: redactTelemetryMetadata({
        role_conflict_event_id: input.eventId,
        operational_event_id: input.operationalEventId ?? null,
        conflict_type: input.conflictType,
        resolution: input.resolution,
        action_attempted: input.actionAttempted,
        policy_workflow_key: input.workflowKey,
        base_authority_level: authority.baseAuthorityLevel,
        effective_authority_level: authority.effectiveAuthorityLevel,
      }),
    })
  })
}
