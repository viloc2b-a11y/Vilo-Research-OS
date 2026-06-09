import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import { computeAmendmentOperationalImpact } from '@/lib/financial-runtime/compute/amendment-impact'
import { computeCoordinatorBurdenEconomics } from '@/lib/financial-runtime/compute/coordinator-economics'
import { computeEarnedFinancialState } from '@/lib/financial-runtime/compute/earned'
import { computeExecutedFinancialState } from '@/lib/financial-runtime/compute/executed'
import { computeExpectedFinancialState } from '@/lib/financial-runtime/compute/expected'
import { detectRevenueLeakage, scoreLeakage } from '@/lib/financial-runtime/compute/leakage'
import { computePaymentLifecycle } from '@/lib/financial-runtime/compute/payment-lifecycle'
import { buildProcedureFinancialAttributions } from '@/lib/financial-runtime/compute/procedure-attribution'
import { computeUnscheduledRuntimeBurden } from '@/lib/financial-runtime/compute/unscheduled-burden'
import { EARNED_RATE_BASIS, FINANCIAL_RUNTIME_VERSION } from '@/lib/financial-runtime/constants'
import { loadVisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import { evaluateFinancialIntegritySafeguards } from '@/lib/financial-runtime/safeguards/integrity'
import type { VisitFinancialRuntime } from '@/lib/financial-runtime/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitFinancialRuntime(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  readiness?: VisitReadinessProjection | null
}): Promise<VisitFinancialRuntime | null> {
  const ctx = await loadVisitFinancialContext({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    readiness: input.readiness,
  })

  if (!ctx) return null

  const graph = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
  })

  const graphBlocked = graph.blockers.some((b) => b.severity === 'blocker')
  const visitBlocked =
    Boolean(ctx.readiness?.readinessStatus === 'blocked')
    || (ctx.readiness?.blockerCount ?? 0) > 0

  const expected = computeExpectedFinancialState(ctx, graph.graphRevision)
  const executed = computeExecutedFinancialState(ctx)
  const earned = computeEarnedFinancialState({
    ctx,
    expected,
    visitBlocked,
    graphBlocked,
  })
  const unscheduledBurden = computeUnscheduledRuntimeBurden(ctx)
  const leakage = detectRevenueLeakage({
    ctx,
    expected,
    executed,
    earned,
    unscheduled: unscheduledBurden,
    graphBlocked,
  })
  const procedureAttributions = buildProcedureFinancialAttributions({
    ctx,
    expected,
    earned,
    leakage,
  })
  const paymentLifecycle = computePaymentLifecycle({
    ctx,
    earned,
  })

  const coordinatorEconomics = await computeCoordinatorBurdenEconomics({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: ctx.studySubjectId,
    visitId: input.visitId,
    earnedBillableCount: earned.billableEarnedCount,
    rescheduleCount: ctx.rescheduleEventCount,
  })

  const amendmentImpact = await computeAmendmentOperationalImpact({
    supabase: input.supabase,
    studyId: input.studyId,
  })

  const safeguards = evaluateFinancialIntegritySafeguards({
    expected,
    executed,
    earned,
    hasProtocolGraph: Boolean(graph.publicationId),
  })

  const leakageScore = scoreLeakage(leakage)
  const earnedRateBasisPoints =
    expected.procedureCount > 0
      ? Math.round((earned.procedureEarnedCount / expected.procedureCount) * EARNED_RATE_BASIS)
      : 0

  const visitFinancialBurdenScore = Math.min(
    100,
    Math.round(leakageScore * 0.5 + coordinatorEconomics.totalBurdenCostScore * 0.3 + unscheduledBurden.burdenScore * 0.2),
  )

  return {
    visitId: ctx.visitId,
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    studySubjectId: ctx.studySubjectId,
    computedAt: new Date().toISOString(),
    financialVersion: FINANCIAL_RUNTIME_VERSION,
    expected,
    executed,
    earned,
    leakage,
    procedureAttributions,
    coordinatorEconomics,
    unscheduledBurden,
    amendmentImpact,
    paymentLifecycle,
    visitFinancialBurdenScore,
    leakageScore,
    earnedRateBasisPoints,
    safeguards,
    snapshot: {
      graphPublicationId: graph.publicationId,
      graphRevision: graph.graphRevision,
      readinessStatus: ctx.readiness?.readinessStatus ?? null,
      paymentLifecycle,
    },
  }
}
