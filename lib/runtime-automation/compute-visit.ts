import { computeVisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/compute-visit'
import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import { computeCoordinatorBurden } from '@/lib/operational-intelligence/metrics/coordinator-burden'
import { buildVisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { RUNTIME_AUTOMATION_VERSION } from '@/lib/runtime-automation/constants'
import { buildVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/plan/build-plan'
import type { VisitRuntimeAutomation } from '@/lib/runtime-automation/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitRuntimeAutomation(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  readiness: VisitReadinessProjection
  orchestration?: VisitCoordinatorOrchestration | null
}): Promise<VisitRuntimeAutomation | null> {
  let orchestration = input.orchestration ?? null

  if (!orchestration) {
    const { data: cached } = await input.supabase
      .from('visit_coordinator_orchestration_projections')
      .select('*')
      .eq('visit_id', input.visitId)
      .maybeSingle()

    if (cached) {
      orchestration = {
        visitId: input.visitId,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.readiness.studySubjectId,
        computedAt: cached.computed_at as string,
        orchestrationVersion: cached.orchestration_version as number,
        nextActions: (cached.next_actions as VisitCoordinatorOrchestration['nextActions']) ?? [],
        priorityScores: cached.priority_scores as VisitCoordinatorOrchestration['priorityScores'],
        urgency: cached.urgency as VisitCoordinatorOrchestration['urgency'],
        blockerChains: (cached.blocker_chains as VisitCoordinatorOrchestration['blockerChains']) ?? [],
        workQueue: cached.work_queue as VisitCoordinatorOrchestration['workQueue'],
        visitExecution: cached.visit_execution as VisitCoordinatorOrchestration['visitExecution'],
        financialLeakageEscalation:
          (cached.snapshot as { financialLeakageEscalation?: VisitCoordinatorOrchestration['financialLeakageEscalation'] })
            ?.financialLeakageEscalation
          ?? {
            leakageScore: 0,
            criticalLeakageCount: 0,
            topLeakageKinds: [],
            recommendedActions: [],
          },
        topPriorityScore: (cached.top_priority_score as number) ?? 0,
        snapshot: (cached.snapshot as Record<string, unknown>) ?? {},
      }
    } else {
      orchestration = await computeVisitCoordinatorOrchestration({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: input.visitId,
        readiness: input.readiness,
      })
    }
  }

  if (!orchestration) return null

  const burden = await computeCoordinatorBurden({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.readiness.studySubjectId,
    visitId: input.visitId,
  })

  const ctx = buildVisitAutomationContext({
    readiness: input.readiness,
    orchestration,
    rescheduleCount: burden.rescheduleCount,
    overdueWorkflowCount: burden.overdueWorkflowCount,
  })

  const plan = buildVisitRuntimeAutomationPlan(ctx)

  const { count: appliedCount } = await input.supabase
    .from('runtime_automation_executions')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', input.visitId)
    .eq('status', 'applied')

  return {
    visitId: input.visitId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.readiness.studySubjectId,
    computedAt: new Date().toISOString(),
    automationVersion: RUNTIME_AUTOMATION_VERSION,
    plan,
    pendingApplyCount: plan.proposedActions.filter((a) => a.status === 'proposed').length,
    appliedCount: appliedCount ?? 0,
    snapshot: {
      triggeredRuleCount: plan.triggeredRules.length,
      adaptedUrgencyScore: plan.adaptedUrgency.adaptedUrgencyScore,
      overloadDetected: plan.overloadAdaptation.overloadDetected,
      topProposedAction: plan.proposedActions[0]?.label ?? null,
    },
  }
}
