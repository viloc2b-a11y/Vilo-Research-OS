/**
 * Apply operational calm to site operations surface (presentation layer).
 */

import type { SiteOperationsSurface } from '@/lib/coordinator-operations/types'
import {
  calmNextActions,
  simplifyOperationalQueues,
} from '@/lib/coordinator-calm/queue-simplification'
import { deriveCoordinatorConfidenceSignals } from '@/lib/coordinator-calm/confidence'

export type CalmSiteSurfaceMeta = {
  visibility: 'site_internal_only'
  confidenceSignals: ReturnType<typeof deriveCoordinatorConfidenceSignals>
  suppressedNoiseCount: number
  criticalActionCount: number
  secondaryActionCount: number
}

export type CalmSiteOperationsSurface = SiteOperationsSurface & {
  calmMeta?: CalmSiteSurfaceMeta
}

export function applyOperationalCalmToSiteSurface(
  surface: SiteOperationsSurface,
): CalmSiteOperationsSurface {
  const simplified = simplifyOperationalQueues(surface.workQueueBuckets)
  const calmActions = calmNextActions(surface.topNextActions)

  const confidenceSignals = deriveCoordinatorConfidenceSignals({
    runtimeId: 'site-operations',
    unsignedProcedureCount: surface.unresolvedSourceSignatureCount,
    incompleteSourceCount: surface.blockedVisitCount,
    unresolvedBlockerCount: surface.blockedVisitCount,
    staleWorkflowCount: surface.overdueVisitCount,
    stabilizationComplete: surface.blockedVisitCount === 0,
    externalReviewReady: false,
  })

  return {
    ...surface,
    topNextActions: calmActions,
    workQueueBuckets: simplified.buckets,
    calmMeta: {
      visibility: 'site_internal_only',
      confidenceSignals,
      suppressedNoiseCount: simplified.suppressedNoiseCount,
      criticalActionCount: simplified.criticalActions.length,
      secondaryActionCount: simplified.secondaryActions.length,
    },
  }
}
