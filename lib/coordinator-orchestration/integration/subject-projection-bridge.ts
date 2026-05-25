import { computeSubjectCoordinatorOrchestration } from '@/lib/coordinator-orchestration/compute-subject'
import { upsertSubjectCoordinatorOrchestrationProjection } from '@/lib/coordinator-orchestration/persist'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichSubjectRuntimeWithCoordinatorOrchestration(input: {
  supabase: SupabaseClient
  projection: SubjectRuntimeProjection
  persist?: boolean
}): Promise<SubjectRuntimeProjection> {
  const orchestration = await computeSubjectCoordinatorOrchestration({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    studySubjectId: input.projection.studySubjectId,
    subject: input.projection,
  })

  if (input.persist) {
    await upsertSubjectCoordinatorOrchestrationProjection(orchestration)
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      coordinatorOrchestration: {
        topPriorityScore: orchestration.topPriorityScore,
        urgencyLevel: orchestration.urgency.level,
        escalationLevel: orchestration.subjectEscalation.escalationLevel,
        actionNowCount: orchestration.workQueue.actionNow.length,
        nextActionLabel: orchestration.nextActions[0]?.label ?? null,
      },
    },
  }
}
