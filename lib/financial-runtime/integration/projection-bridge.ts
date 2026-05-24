import { computeVisitFinancialRuntime } from '@/lib/financial-runtime/compute-visit'
import { upsertVisitFinancialRuntimeProjection } from '@/lib/financial-runtime/persist'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enriches visit readiness snapshot with financial runtime (derived only).
 */
export async function enrichVisitReadinessWithFinancialRuntime(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persist?: boolean
}): Promise<VisitReadinessProjection> {
  const financial = await computeVisitFinancialRuntime({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    visitId: input.projection.visitId,
    readiness: input.projection,
  })

  if (!financial) return input.projection

  if (input.persist) {
    await upsertVisitFinancialRuntimeProjection(input.supabase, financial)
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      financialRuntime: {
        expectedProcedureCount: financial.expected.procedureCount,
        executedProcedureCount: financial.executed.procedureCompletedCount,
        earnedProcedureCount: financial.earned.procedureEarnedCount,
        billableEarnedCount: financial.earned.billableEarnedCount,
        leakageScore: financial.leakageScore,
        earnedRateBasisPoints: financial.earnedRateBasisPoints,
        visitFinancialBurdenScore: financial.visitFinancialBurdenScore,
        leakageItemCount: financial.leakage.length,
        topLeakage: financial.leakage.slice(0, 3).map((l) => l.label),
        coordinatorBurdenScore: financial.coordinatorEconomics.totalBurdenCostScore,
      },
    },
  }
}
