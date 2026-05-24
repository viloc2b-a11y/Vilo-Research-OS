import { computeSubjectFinancialRuntime } from '@/lib/financial-runtime/compute-subject'
import { upsertSubjectFinancialRuntimeProjection } from '@/lib/financial-runtime/persist'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichSubjectRuntimeWithFinancialRuntime(input: {
  supabase: SupabaseClient
  projection: SubjectRuntimeProjection
  persist?: boolean
}): Promise<SubjectRuntimeProjection> {
  const financial = await computeSubjectFinancialRuntime({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    studySubjectId: input.projection.studySubjectId,
  })

  if (input.persist) {
    await upsertSubjectFinancialRuntimeProjection(input.supabase, financial)
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      financialRuntime: {
        expectedProcedureCount: financial.expected.procedureCount,
        executedProcedureCount: financial.executed.procedureCompletedCount,
        earnedProcedureCount: financial.earned.procedureEarnedCount,
        leakageScore: financial.leakageScore,
        earnedRateBasisPoints: financial.earnedRateBasisPoints,
        coordinatorBurdenScore: financial.coordinatorEconomics.totalBurdenCostScore,
      },
    },
  }
}
