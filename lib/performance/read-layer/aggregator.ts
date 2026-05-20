import type { PerformanceScope } from '@/lib/performance/types'
import type { PerformanceReadModel } from '@/app/(ops)/performance/_lib/performance-types'
import { buildFromSignals } from '@/lib/performance/read-layer/build-from-signals'
import { buildFromRpc } from '@/lib/performance/read-layer/build-from-rpc'
import { recordVpiLoadTelemetryIfOverBudget } from '@/lib/performance/telemetry/log-vpi-load-telemetry'

export type AggregatorMode = 'rpc' | 'fallback'

export type BuildPerformanceReadModelOptions = {
  mode?: AggregatorMode
}

/** When `true`, aggregator prefers `vpi_load_dashboard` RPC with signal fallback. */
export const VPI_USE_RPC = process.env.VPI_USE_RPC === 'true'

export async function buildPerformanceReadModel(
  scope: PerformanceScope,
  opts?: BuildPerformanceReadModelOptions,
): Promise<PerformanceReadModel> {
  const requestedMode = opts?.mode ?? (VPI_USE_RPC ? 'rpc' : 'fallback')
  const startedAt = Date.now()
  let resolvedMode: AggregatorMode = requestedMode
  let model: PerformanceReadModel | undefined

  try {
    if (requestedMode === 'fallback') {
      model = await buildFromSignals(scope)
      return model
    }

    try {
      model = await buildFromRpc(scope)
      resolvedMode = 'rpc'
      return model
    } catch (err) {
      console.warn('[VPI] vpi_load_dashboard failed, falling back to signal reads', err)
      resolvedMode = 'fallback'
      model = await buildFromSignals(scope)
      return model
    }
  } finally {
    if (model) {
      const durationMs = Date.now() - startedAt
      const studyId =
        scope.selectedStudyId ?? model.studyCards[0]?.studyId ?? null
      void recordVpiLoadTelemetryIfOverBudget({
        scope,
        mode: resolvedMode,
        durationMs,
        studyId,
        actorUserId: scope.userId,
      })
    }
  }
}
