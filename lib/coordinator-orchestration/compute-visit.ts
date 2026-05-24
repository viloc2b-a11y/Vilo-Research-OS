import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import { computeVisitFinancialRuntime } from '@/lib/financial-runtime/compute-visit'
import { computeCoordinatorBurden } from '@/lib/operational-intelligence/metrics/coordinator-burden'
import { buildBlockerResolutionChains } from '@/lib/coordinator-orchestration/compute/blocker-chains'
import { deriveCoordinatorNextActions } from '@/lib/coordinator-orchestration/compute/next-actions'
import { computeOperationalPriorityScores } from '@/lib/coordinator-orchestration/compute/priority-score'
import { computeRuntimeUrgency } from '@/lib/coordinator-orchestration/compute/urgency'
import { buildVisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import { COORDINATOR_ORCHESTRATION_VERSION } from '@/lib/coordinator-orchestration/constants'
import { orchestrateFinancialLeakageEscalation } from '@/lib/coordinator-orchestration/orchestrate/financial-leakage'
import { orchestrateVisitExecution } from '@/lib/coordinator-orchestration/orchestrate/visit-execution'
import { deriveWorkQueue } from '@/lib/coordinator-orchestration/queue/derive-work-queue'
import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitCoordinatorOrchestration(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  readiness: VisitReadinessProjection
}): Promise<VisitCoordinatorOrchestration | null> {
  const [graph, finRow, burden] = await Promise.all([
    evaluateVisitGraphOrchestration({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId,
    }),
    input.supabase
      .from('visit_financial_runtime_projections')
      .select('leakage, leakage_score')
      .eq('visit_id', input.visitId)
      .maybeSingle(),
    computeCoordinatorBurden({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId: input.readiness.studySubjectId,
      visitId: input.visitId,
    }),
  ])

  const graphBlocked = graph.blockers.some((b) => b.severity === 'blocker')

  let financial = finRow.data
    ? {
        leakage: (finRow.data.leakage as import('@/lib/financial-runtime/types').RevenueLeakageItem[]) ?? [],
        leakageScore: (finRow.data.leakage_score as number) ?? 0,
      }
    : null

  if (!financial) {
    const computed = await computeVisitFinancialRuntime({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId,
      readiness: input.readiness,
    })
    financial = computed
      ? { leakage: computed.leakage, leakageScore: computed.leakageScore }
      : null
  }

  const ctx = buildVisitOrchestrationContext({
    readiness: input.readiness,
    leakageItems: financial?.leakage ?? [],
    rescheduleCount: burden.rescheduleCount,
    overdueWorkflowCount: burden.overdueWorkflowCount,
  })

  const nextActions = deriveCoordinatorNextActions(ctx)
  const priorityScores = computeOperationalPriorityScores(ctx)
  const urgency = computeRuntimeUrgency({
    priorityScores,
    nextActions,
    readinessBlocked: input.readiness.readinessStatus === 'blocked',
    overdueWorkflowCount: ctx.overdueWorkflowCount,
  })
  const blockerChains = buildBlockerResolutionChains({
    readiness: input.readiness,
    nextActions,
  })
  const workQueue = deriveWorkQueue({
    nextActions,
    urgency,
    readiness: input.readiness,
  })
  const visitExecution = orchestrateVisitExecution({
    ctx,
    nextActions,
    graphBlocked,
  })
  const financialLeakageEscalation = orchestrateFinancialLeakageEscalation({
    leakageItems: financial?.leakage ?? [],
    leakageScore: financial?.leakageScore ?? ctx.financialRuntime.leakageScore ?? 0,
    topLeakageLabels: ctx.financialRuntime.topLeakage,
  })

  const topPriorityScore = Math.max(
    priorityScores.compositeScore,
    nextActions[0]?.priority ?? 0,
    urgency.urgencyScore,
  )

  return {
    visitId: input.visitId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.readiness.studySubjectId,
    computedAt: new Date().toISOString(),
    orchestrationVersion: COORDINATOR_ORCHESTRATION_VERSION,
    nextActions: nextActions.slice(0, 25),
    priorityScores,
    urgency,
    blockerChains,
    workQueue,
    visitExecution,
    financialLeakageEscalation,
    topPriorityScore,
    snapshot: {
      readinessStatus: input.readiness.readinessStatus,
      graphBlocked,
      actionNowCount: workQueue.actionNow.length,
      escalationCount: workQueue.escalation.length,
      piReviewCount: workQueue.piReview.length,
    },
  }
}
