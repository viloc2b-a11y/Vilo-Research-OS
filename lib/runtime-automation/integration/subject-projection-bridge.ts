import { computeSubjectRuntimeAutomation } from '@/lib/runtime-automation/compute-subject'
import { upsertSubjectRuntimeAutomationProjection } from '@/lib/runtime-automation/persist'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichSubjectRuntimeWithRuntimeAutomation(input: {
  supabase: SupabaseClient
  projection: SubjectRuntimeProjection
  persist?: boolean
}): Promise<SubjectRuntimeProjection> {
  const automation = await computeSubjectRuntimeAutomation({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    studySubjectId: input.projection.studySubjectId,
    subject: input.projection,
  })

  if (input.persist) {
    await upsertSubjectRuntimeAutomationProjection(input.supabase, automation)
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      runtimeAutomation: {
        proposedActionCount: automation.plan.proposedActions.length,
        pendingApplyCount: automation.pendingApplyCount,
        adaptedUrgencyScore: automation.plan.adaptedUrgency.adaptedUrgencyScore,
      },
    },
  }
}
