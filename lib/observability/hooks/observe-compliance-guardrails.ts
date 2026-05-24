/**
 * OBS-2 — Compliance guardrail telemetry (observability only; no enforcement).
 */

import type {
  EffectiveAuthorityLevel,
  WorkflowAuthorityLevel,
  WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'
import { WORKFLOW_KEY } from '@/lib/governance/workflow-authority/constants'
import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import { getObsWorkflowAuthorityDefault } from '@/lib/observability/workflow-authority-defaults'
import type { SupabaseClient } from '@supabase/supabase-js'

const TEMPORAL_RULE_WORKFLOW_KEY: Record<string, WorkflowKey> = {
  consent_before_screening: WORKFLOW_KEY.ELIGIBILITY,
  screening_before_enrollment: WORKFLOW_KEY.ELIGIBILITY,
  ae_onset_not_before_first_dose: WORKFLOW_KEY.AE_WORKFLOW,
  lab_collection_before_lab_result: WORKFLOW_KEY.LAB_SAFETY_ESCALATION,
  source_signature_after_capture: WORKFLOW_KEY.SOURCE_SIGNING,
}

function resolveTemporalRuleWorkflowKey(ruleKey: string): WorkflowKey | null {
  return TEMPORAL_RULE_WORKFLOW_KEY[ruleKey] ?? null
}

export type ObserveTemporalConsistencyEvaluatedInput = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  actorUserId?: string | null
  evaluationId: string
  operationalEventId?: string | null
  ruleKey: string
  evaluationResult: string
  severity: string
  workflowKey?: WorkflowKey | null
}

export function observeTemporalConsistencyEvaluated(
  input: ObserveTemporalConsistencyEvaluatedInput,
): void {
  safeObserve(OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED, async () => {
    const workflowKey =
      input.workflowKey ?? resolveTemporalRuleWorkflowKey(input.ruleKey)
    const authority = workflowKey ? getObsWorkflowAuthorityDefault(workflowKey) : null

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED,
      workflowKey: workflowKey ?? undefined,
      actorUserId: input.actorUserId ?? null,
      studyId: input.studyId,
      studySubjectId: input.studySubjectId ?? null,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      metadata: {
        evaluation_id: input.evaluationId,
        operational_event_id: input.operationalEventId ?? null,
        rule_key: input.ruleKey,
        evaluation_result: input.evaluationResult,
        severity: input.severity,
        base_authority_level: authority?.baseAuthorityLevel ?? null,
        effective_authority_level: authority?.effectiveAuthorityLevel ?? null,
      },
    })
  })
}

export type ObserveDelegationRuntimeCheckedInput = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  actorUserId: string
  checkId: string
  operationalEventId?: string | null
  procedureKey?: string | null
  workflowKey?: WorkflowKey | null
  checkResult: string
  delegated: boolean
  systemBlocking: boolean
  requiresPiDelegation: boolean
  regulated: boolean
}

export function observeDelegationRuntimeChecked(
  input: ObserveDelegationRuntimeCheckedInput,
): void {
  safeObserve(OBS_HOOK_SIGNAL.DELEGATION_RUNTIME_CHECKED, async () => {
    const workflowKey = input.workflowKey ?? null
    const authority = workflowKey ? getObsWorkflowAuthorityDefault(workflowKey) : null

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.DELEGATION_RUNTIME_CHECKED,
      workflowKey: workflowKey ?? undefined,
      actorUserId: input.actorUserId,
      studyId: input.studyId,
      metadata: {
        check_id: input.checkId,
        operational_event_id: input.operationalEventId ?? null,
        procedure_key: input.procedureKey ?? null,
        check_result: input.checkResult,
        delegated: input.delegated,
        system_blocking: input.systemBlocking,
        requires_pi_delegation: input.requiresPiDelegation,
        regulated: input.regulated,
        base_authority_level: authority?.baseAuthorityLevel ?? null,
        effective_authority_level: authority?.effectiveAuthorityLevel ?? null,
      },
    })
  })
}

export type ObserveBreakGlassAccessRequestedInput = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  actorUserId: string
  eventId: string
  operationalEventId?: string | null
  workflowKey: WorkflowKey
  baseAuthorityLevel?: WorkflowAuthorityLevel | null
  effectiveAuthorityLevel?: EffectiveAuthorityLevel | null
  accessScope: string
  resourceType: string
  resourceId?: string | null
  approvalMode: string
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
}

export function observeBreakGlassAccessRequested(
  input: ObserveBreakGlassAccessRequestedInput,
): void {
  safeObserve(OBS_HOOK_SIGNAL.BREAK_GLASS_ACCESS_REQUESTED, async () => {
    const base =
      input.baseAuthorityLevel ??
      getObsWorkflowAuthorityDefault(input.workflowKey).baseAuthorityLevel
    const effective =
      input.effectiveAuthorityLevel ??
      getObsWorkflowAuthorityDefault(input.workflowKey).effectiveAuthorityLevel

    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.BREAK_GLASS_ACCESS_REQUESTED,
      workflowKey: input.workflowKey,
      actorUserId: input.actorUserId,
      studyId: input.studyId,
      studySubjectId: input.studySubjectId ?? null,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      metadata: {
        break_glass_event_id: input.eventId,
        operational_event_id: input.operationalEventId ?? null,
        access_scope: input.accessScope,
        resource_type: input.resourceType,
        resource_id: input.resourceId ?? null,
        approval_mode: input.approvalMode,
        base_authority_level: base,
        effective_authority_level: effective,
      },
    })
  })
}
