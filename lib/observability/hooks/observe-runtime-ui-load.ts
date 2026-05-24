/**
 * OBS-2 — Runtime UI model load telemetry (aggregate counts only; no PHI).
 */

import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import type { SubjectRuntimeUiModel, VisitRuntimeUiModel } from '@/lib/runtime-ui/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export function observeVisitRuntimeUiModelLoaded(input: {
  supabase: SupabaseClient
  model: VisitRuntimeUiModel
}): void {
  const { model } = input
  const nextActionCount =
    (model.nextAction ? 1 : 0) +
    model.workQueue.reduce((sum, bucket) => sum + bucket.items.length, 0)

  safeObserve(OBS_HOOK_SIGNAL.VISIT_RUNTIME_UI_MODEL_LOADED, async () => {
    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: model.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.VISIT_RUNTIME_UI_MODEL_LOADED,
      studyId: model.studyId,
      studySubjectId: model.studySubjectId,
      visitId: model.visitId,
      metadata: {
        blocked: model.whyBlocked.blocked,
        next_action_count: nextActionCount,
        automation_proposal_count: model.automationProposals.length,
        leakage_visible: model.leakage.show,
        readiness_status: model.readinessStatus,
        projection_computed_at: model.computedAt,
      },
    })
  })
}

export function observeSubjectRuntimeUiModelLoaded(input: {
  supabase: SupabaseClient
  model: SubjectRuntimeUiModel
}): void {
  const { model } = input
  const nextActionCount = model.nextAction ? 1 : 0

  safeObserve(OBS_HOOK_SIGNAL.SUBJECT_RUNTIME_UI_MODEL_LOADED, async () => {
    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: model.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.SUBJECT_RUNTIME_UI_MODEL_LOADED,
      studyId: model.studyId,
      studySubjectId: model.studySubjectId,
      metadata: {
        blocked: model.whyBlocked.blocked,
        next_action_count: nextActionCount,
        automation_proposal_count: model.automationProposals.length,
        leakage_visible: false,
        operational_health: model.operationalHealth,
      },
    })
  })
}
