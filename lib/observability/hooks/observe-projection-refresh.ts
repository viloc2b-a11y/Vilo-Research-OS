/**
 * OBS-2 — Projection refresh telemetry hooks.
 */

import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { recordWorkflowTelemetry } from '@/lib/observability/record-workflow-telemetry'
import { WORKFLOW_TELEMETRY_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ProjectionRefreshObsInput = {
  supabase: SupabaseClient
  organizationId: string
  signal:
    | typeof OBS_HOOK_SIGNAL.VISIT_READINESS_PROJECTION_REFRESHED
    | typeof OBS_HOOK_SIGNAL.SUBJECT_RUNTIME_PROJECTION_REFRESHED
    | typeof OBS_HOOK_SIGNAL.STUDY_EXECUTION_PROJECTION_REFRESHED
  scopeId: string
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  projectionVersion: number
  refreshMode: string
  ok: boolean
  rowsAffected: number
  error?: string | null
}

export function observeProjectionRefreshed(input: ProjectionRefreshObsInput): void {
  safeObserve(input.signal, async () => {
    await recordWorkflowTelemetry({
      supabase: input.supabase,
      organizationId: input.organizationId,
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: input.signal,
      studyId: input.studyId ?? null,
      studySubjectId: input.studySubjectId ?? null,
      visitId: input.visitId ?? null,
      metadata: {
        scope_id: input.scopeId,
        projection_version: input.projectionVersion,
        refresh_mode: input.refreshMode,
        ok: input.ok,
        rows_affected: input.rowsAffected,
        error: input.error ?? null,
      },
    })
  })
}
