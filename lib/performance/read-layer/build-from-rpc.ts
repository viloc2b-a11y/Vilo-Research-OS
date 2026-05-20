import type { PerformanceScope } from '@/lib/performance/types'
import { getReadLayerClient } from '@/lib/performance/read-layer/query/supabase-client'
import { toQueryScope } from '@/lib/performance/read-layer/scope'
import { loadVisitSnapshot } from '@/lib/performance/read-layer/signals/visit-signals'
import {
  mapRpcDashboardToReadModel,
  parseVpiDashboardPayload,
} from '@/lib/performance/read-layer/rpc-dashboard'
import type { PerformanceReadModel } from '@/app/(ops)/performance/_lib/performance-types'
import { buildFromSignals } from '@/lib/performance/read-layer/build-from-signals'

export async function buildFromRpc(scope: PerformanceScope): Promise<PerformanceReadModel> {
  const { organizationIds, selectedStudyId } = scope

  if (organizationIds.length === 0) {
    return buildFromSignals(scope)
  }

  const client = await getReadLayerClient()

  const { data, error } = await client.rpc('vpi_load_dashboard')

  if (error) {
    throw error
  }

  const payload = parseVpiDashboardPayload(data)
  if (!payload) {
    throw new Error('vpi_load_dashboard returned an invalid payload shape')
  }

  let studyIds = [...new Set(payload.study_health.map((row) => row.study_id))]
  if (selectedStudyId) {
    studyIds = studyIds.filter((id) => id === selectedStudyId)
  }

  const emptySnapshot = {
    totalVisits: 0,
    byVisitStatus: {},
    bySourceStatus: {},
    byReviewStatus: {},
  }

  const { snapshot, errors: visitSnapshotErrors } =
    studyIds.length > 0
      ? await loadVisitSnapshot(client, toQueryScope(organizationIds, studyIds))
      : { snapshot: emptySnapshot, errors: [] as { source: string; message: string }[] }

  return mapRpcDashboardToReadModel({
    payload,
    organizationCount: organizationIds.length,
    selectedStudyId,
    visitSnapshot: snapshot,
    visitSnapshotErrors,
    rpcError: null,
  })
}
