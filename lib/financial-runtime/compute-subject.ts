import { computeVisitFinancialRuntime } from '@/lib/financial-runtime/compute-visit'
import { computeAmendmentOperationalImpact } from '@/lib/financial-runtime/compute/amendment-impact'
import { computeCoordinatorBurdenEconomics } from '@/lib/financial-runtime/compute/coordinator-economics'
import { scoreLeakage } from '@/lib/financial-runtime/compute/leakage'
import { EARNED_RATE_BASIS, FINANCIAL_RUNTIME_VERSION } from '@/lib/financial-runtime/constants'
import { evaluateFinancialIntegritySafeguards } from '@/lib/financial-runtime/safeguards/integrity'
import type { SubjectFinancialRuntime } from '@/lib/financial-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeSubjectFinancialRuntime(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
}): Promise<SubjectFinancialRuntime> {
  const { data: visitRows } = await input.supabase
    .from('visit_financial_runtime_projections')
    .select(
      'expected_procedure_count, executed_procedure_count, earned_procedure_count, leakage, leakage_score, earned_rate_basis_points, unscheduled_burden, visit_financial_burden_score',
    )
    .eq('study_subject_id', input.studySubjectId)

  let expectedCount = 0
  let executedCount = 0
  let earnedCount = 0
  let billableExpected = 0
  let billableEarned = 0
  const leakageItems = []
  let unscheduledTotal = 0
  let visitBurdenTotal = 0

  for (const row of visitRows ?? []) {
    expectedCount += (row.expected_procedure_count as number) ?? 0
    executedCount += (row.executed_procedure_count as number) ?? 0
    earnedCount += (row.earned_procedure_count as number) ?? 0
    const leakage = (row.leakage as unknown[]) ?? []
    leakageItems.push(...(leakage as SubjectFinancialRuntime['leakage']))
    unscheduledTotal += (row.unscheduled_burden as { burdenScore?: number })?.burdenScore ?? 0
    visitBurdenTotal += (row.visit_financial_burden_score as number) ?? 0
  }

  if ((visitRows ?? []).length === 0) {
    const { data: visits } = await input.supabase
      .from('visits')
      .select('id')
      .eq('study_subject_id', input.studySubjectId)
      .limit(20)

    for (const v of visits ?? []) {
      const fin = await computeVisitFinancialRuntime({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: v.id as string,
      })
      if (!fin) continue
      expectedCount += fin.expected.procedureCount
      executedCount += fin.executed.procedureCompletedCount
      earnedCount += fin.earned.procedureEarnedCount
      billableExpected += fin.expected.billableProcedureCount
      billableEarned += fin.earned.billableEarnedCount
      leakageItems.push(...fin.leakage)
      unscheduledTotal += fin.unscheduledBurden.burdenScore
      visitBurdenTotal += fin.visitFinancialBurdenScore
    }
  }

  const coordinatorEconomics = await computeCoordinatorBurdenEconomics({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: null,
    earnedBillableCount: billableEarned || earnedCount,
    rescheduleCount: 0,
  })

  const amendmentImpact = await computeAmendmentOperationalImpact({
    supabase: input.supabase,
    studyId: input.studyId,
  })

  const leakageScore = scoreLeakage(leakageItems)
  const earnedRateBasisPoints =
    expectedCount > 0 ? Math.round((earnedCount / expectedCount) * EARNED_RATE_BASIS) : 0

  const safeguards = evaluateFinancialIntegritySafeguards({
    expected: {
      procedureCount: expectedCount,
      billableProcedureCount: billableExpected,
      requiredProcedureCount: 0,
      conditionalExpectedCount: 0,
      units: [],
      protocolGraphRevision: null,
    },
    executed: {
      procedureCompletedCount: executedCount,
      procedureBillableCompletedCount: billableEarned,
      workflowExecutionCount: 0,
      sourceCaptureSubmittedCount: 0,
      safetyExecutionCount: 0,
      units: [],
    },
    earned: {
      procedureEarnedCount: earnedCount,
      billableEarnedCount: billableEarned,
      graphCompliantEarnedCount: earnedCount,
      signableEarnedCount: earnedCount,
      units: [],
    },
    hasProtocolGraph: Boolean(amendmentImpact.activeGraphPublicationId),
  })

  return {
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    computedAt: new Date().toISOString(),
    financialVersion: FINANCIAL_RUNTIME_VERSION,
    expected: { procedureCount: expectedCount, billableProcedureCount: billableExpected },
    executed: { procedureCompletedCount: executedCount },
    earned: { procedureEarnedCount: earnedCount, billableEarnedCount: billableEarned },
    leakage: leakageItems.slice(0, 50),
    coordinatorEconomics,
    unscheduledBurden: {
      visitCount: visitRows?.length ?? 0,
      totalBurdenScore: unscheduledTotal,
    },
    amendmentImpact,
    leakageScore,
    earnedRateBasisPoints,
    safeguards,
    snapshot: {
      visitBurdenTotal,
      visitProjectionCount: visitRows?.length ?? 0,
    },
  }
}
