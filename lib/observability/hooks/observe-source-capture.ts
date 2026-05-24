/**
 * OBS-2 — Source capture lifecycle telemetry hooks.
 */

import { WORKFLOW_KEY } from '@/lib/governance/workflow-authority/constants'
import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SourceCaptureScope = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
  procedureExecutionId: string
  actorUserId?: string | null
  sourceResponseSetId?: string | null
}

function observeSourceSignal(
  scope: SourceCaptureScope,
  signal: (typeof OBS_HOOK_SIGNAL)[keyof typeof OBS_HOOK_SIGNAL],
  extra?: Record<string, unknown>,
): void {
  safeObserve(signal, async () => {
    await recordWorkflowTelemetry({
      supabase: scope.supabase,
      organizationId: scope.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal,
      workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
      actorUserId: scope.actorUserId ?? null,
      studyId: scope.studyId,
      studySubjectId: scope.studySubjectId,
      visitId: scope.visitId,
      procedureExecutionId: scope.procedureExecutionId,
      metadata: {
        source_response_set_id: scope.sourceResponseSetId ?? null,
        ...extra,
      },
    })
  })
}

export function observeSourceResponseSetOpened(scope: SourceCaptureScope): void {
  observeSourceSignal(scope, OBS_HOOK_SIGNAL.SOURCE_RESPONSE_SET_OPENED)
}

export function observeSourceDraftSaved(scope: SourceCaptureScope): void {
  observeSourceSignal(scope, OBS_HOOK_SIGNAL.SOURCE_DRAFT_SAVED)
}

export function observeSourceResponseSetSubmitted(scope: SourceCaptureScope): void {
  observeSourceSignal(scope, OBS_HOOK_SIGNAL.SOURCE_RESPONSE_SET_SUBMITTED)
}

export function observeSourceValidationFailed(
  scope: SourceCaptureScope,
  input: { errorCodes: string[]; hardBlockCount: number },
): void {
  observeSourceSignal(scope, OBS_HOOK_SIGNAL.SOURCE_VALIDATION_FAILED, {
    error_codes: input.errorCodes,
    hard_block_count: input.hardBlockCount,
  })
}
