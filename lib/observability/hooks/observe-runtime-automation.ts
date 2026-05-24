/**
 * OBS-2 — Runtime automation telemetry hooks.
 */

import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RuntimeAutomationObsScope = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  actorUserId: string | null
  executionId?: string | null
  actionId?: string | null
  planId?: string | null
}

function observeAutomationSignal(
  scope: RuntimeAutomationObsScope,
  signal: (typeof OBS_HOOK_SIGNAL)[keyof typeof OBS_HOOK_SIGNAL],
  extra?: Record<string, unknown>,
): void {
  safeObserve(signal, async () => {
    await recordWorkflowTelemetry({
      supabase: scope.supabase,
      organizationId: scope.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.AUTOMATION_SIGNAL,
      signal,
      actorUserId: scope.actorUserId,
      studyId: scope.studyId,
      studySubjectId: scope.studySubjectId,
      visitId: scope.visitId,
      metadata: {
        execution_id: scope.executionId ?? null,
        action_id: scope.actionId ?? null,
        plan_id: scope.planId ?? null,
        ...extra,
      },
    })
  })
}

export function observeAutomationProposed(
  scope: RuntimeAutomationObsScope,
  extra?: Record<string, unknown>,
): void {
  observeAutomationSignal(scope, OBS_HOOK_SIGNAL.AUTOMATION_PROPOSED, extra)
}

export function observeAutomationApplied(scope: RuntimeAutomationObsScope): void {
  observeAutomationSignal(scope, OBS_HOOK_SIGNAL.AUTOMATION_APPLIED)
}

export function observeAutomationReversed(scope: RuntimeAutomationObsScope): void {
  observeAutomationSignal(scope, OBS_HOOK_SIGNAL.AUTOMATION_REVERSED)
}

export function observeAutomationOverridden(scope: RuntimeAutomationObsScope): void {
  observeAutomationSignal(scope, OBS_HOOK_SIGNAL.AUTOMATION_OVERRIDDEN)
}
