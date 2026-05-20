import { buildPerformanceReadModel, resolveScope } from '@/lib/performance/read-layer'
import type { PerformanceReadModel } from '@/app/(ops)/performance/_lib/performance-types'

/**
 * Backwards-compatible facade for the /performance page.
 * Operational reads live in lib/performance/read-layer (Phase 7A).
 */
export async function loadPerformanceReadModel(
  organizationIds: string[],
  selectedStudyId: string | null = null,
  userId: string | null = null,
): Promise<PerformanceReadModel> {
  const scope = resolveScope({
    organizationIds,
    selectedStudyId,
    userId,
  })
  return buildPerformanceReadModel(scope)
}

export type { PerformanceReadModel }
