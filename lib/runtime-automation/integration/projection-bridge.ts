import { computeVisitRuntimeAutomation } from '@/lib/runtime-automation/compute-visit'
import { upsertVisitRuntimeAutomationProjection } from '@/lib/runtime-automation/persist'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enriches visit readiness with derived automation plan (no apply side effects).
 */
export async function enrichVisitReadinessWithRuntimeAutomation(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persist?: boolean
}): Promise<VisitReadinessProjection> {
  const { data: orchRow } = await input.supabase
    .from('visit_coordinator_orchestration_projections')
    .select('visit_id, computed_at, orchestration_version, next_actions, priority_scores, urgency, blocker_chains, work_queue, visit_execution, top_priority_score, snapshot')
    .eq('visit_id', input.projection.visitId)
    .maybeSingle()

  const automation = await computeVisitRuntimeAutomation({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    visitId: input.projection.visitId,
    readiness: input.projection,
    orchestration: orchRow
      ? {
          visitId: input.projection.visitId,
          organizationId: input.projection.organizationId,
          studyId: input.projection.studyId,
          studySubjectId: input.projection.studySubjectId,
          computedAt: orchRow.computed_at as string,
          orchestrationVersion: orchRow.orchestration_version as number,
          nextActions: (orchRow.next_actions as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['nextActions']) ?? [],
          priorityScores: orchRow.priority_scores as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['priorityScores'],
          urgency: orchRow.urgency as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['urgency'],
          blockerChains: (orchRow.blocker_chains as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['blockerChains']) ?? [],
          workQueue: orchRow.work_queue as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['workQueue'],
          visitExecution: orchRow.visit_execution as import('@/lib/coordinator-orchestration/types').VisitCoordinatorOrchestration['visitExecution'],
          financialLeakageEscalation: {
            leakageScore: (input.projection.snapshot.financialRuntime as { leakageScore?: number })?.leakageScore ?? 0,
            criticalLeakageCount: 0,
            topLeakageKinds: [],
            recommendedActions: [],
          },
          topPriorityScore: (orchRow.top_priority_score as number) ?? 0,
          snapshot: (orchRow.snapshot as Record<string, unknown>) ?? {},
        }
      : null,
  })

  if (!automation) return input.projection

  if (input.persist) {
    await upsertVisitRuntimeAutomationProjection(input.supabase, automation)
  }

  const top = automation.plan.proposedActions[0]

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      runtimeAutomation: {
        planId: automation.plan.planId,
        triggeredRuleCount: automation.plan.triggeredRules.length,
        proposedActionCount: automation.plan.proposedActions.length,
        pendingApplyCount: automation.pendingApplyCount,
        adaptedUrgencyScore: automation.plan.adaptedUrgency.adaptedUrgencyScore,
        overloadDetected: automation.plan.overloadAdaptation.overloadDetected,
        topProposedAction: top?.label ?? null,
        coordinatorSupervised: automation.plan.coordinatorSupervised,
      },
    },
  }
}
