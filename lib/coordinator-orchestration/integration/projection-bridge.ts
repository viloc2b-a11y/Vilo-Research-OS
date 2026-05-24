import { computeVisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/compute-visit'
import { upsertVisitCoordinatorOrchestrationProjection } from '@/lib/coordinator-orchestration/persist'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enriches visit readiness snapshot with coordinator orchestration (derived only).
 */
export async function enrichVisitReadinessWithCoordinatorOrchestration(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persist?: boolean
}): Promise<VisitReadinessProjection> {
  const orchestration = await computeVisitCoordinatorOrchestration({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    visitId: input.projection.visitId,
    readiness: input.projection,
  })

  if (!orchestration) return input.projection

  if (input.persist) {
    await upsertVisitCoordinatorOrchestrationProjection(input.supabase, orchestration)
  }

  const topAction = orchestration.nextActions[0]

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      coordinatorOrchestration: {
        topPriorityScore: orchestration.topPriorityScore,
        urgencyLevel: orchestration.urgency.level,
        urgencyScore: orchestration.urgency.urgencyScore,
        nextActionLabel: topAction?.label ?? null,
        nextActionKind: topAction?.kind ?? null,
        actionNowCount: orchestration.workQueue.actionNow.length,
        escalationCount: orchestration.workQueue.escalation.length,
        piReviewCount: orchestration.workQueue.piReview.length,
        visitPhase: orchestration.visitExecution.phase,
        primaryObjective: orchestration.visitExecution.primaryObjective,
      },
    },
  }
}
