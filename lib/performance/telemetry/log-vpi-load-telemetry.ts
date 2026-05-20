import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { createServerClient } from '@/lib/supabase/server'
import type { AggregatorMode } from '@/lib/performance/read-layer/aggregator'
import type { PerformanceScope } from '@/lib/performance/types'

export const VPI_LOAD_TELEMETRY = 'VPI_LOAD_TELEMETRY'

/** Portfolio read-model P95 budget (see docs/VPI-PRODUCTION-PLAN.md §8.2). */
export const VPI_READ_MODEL_BUDGET_MS = 800

export type VpiLoadTelemetryInput = {
  scope: PerformanceScope
  mode: AggregatorMode
  durationMs: number
  studyId: string | null
  actorUserId: string | null
}

/**
 * Best-effort telemetry when a VPI read exceeds the performance budget.
 * Never throws — failures are logged to stderr only.
 */
export async function recordVpiLoadTelemetryIfOverBudget(
  input: VpiLoadTelemetryInput,
): Promise<void> {
  if (input.durationMs < VPI_READ_MODEL_BUDGET_MS) return

  const organizationId = input.scope.organizationIds[0]
  const studyId = input.studyId ?? input.scope.selectedStudyId
  if (!organizationId || !studyId) return

  try {
    const supabase = await createServerClient()
    await logOperationalEvent({
      supabase,
      organizationId,
      studyId,
      eventType: VPI_LOAD_TELEMETRY,
      actorUserId: input.actorUserId,
      payload: {
        duration_ms: input.durationMs,
        budget_ms: VPI_READ_MODEL_BUDGET_MS,
        mode: input.mode,
        selected_study_id: input.scope.selectedStudyId,
        organization_count: input.scope.organizationIds.length,
      },
    })
  } catch (err) {
    console.warn('[VPI] failed to record load telemetry', err)
  }
}
