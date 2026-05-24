import { computeCoordinatorBurden } from '@/lib/operational-intelligence/metrics/coordinator-burden'
import type { CoordinatorBurdenEconomics } from '@/lib/financial-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeCoordinatorBurdenEconomics(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId?: string | null
  earnedBillableCount: number
  rescheduleCount: number
}): Promise<CoordinatorBurdenEconomics> {
  const burden = await computeCoordinatorBurden({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId || null,
  })

  const workflowDensity = burden.openWorkflowCount + burden.openQueryCount
  const totalBurdenCostScore = Math.min(
    100,
    burden.burdenScore + input.rescheduleCount * 5,
  )

  return {
    workflowDensity,
    sourceBurdenUnits: burden.sourceBacklogCount,
    queryBurdenUnits: burden.openQueryCount,
    safetyBurdenUnits: burden.safetyBurdenCount,
    rescheduleBurdenUnits: input.rescheduleCount,
    totalBurdenCostScore,
    burdenToEarnedRatio:
      input.earnedBillableCount > 0
        ? Math.round((totalBurdenCostScore / input.earnedBillableCount) * 100) / 100
        : null,
  }
}
