import { persistDerivedProjectionSafe } from '@/lib/projections/runtime-projection-persist'
import type {
  SubjectCoordinatorOrchestration,
  VisitCoordinatorOrchestration,
} from '@/lib/coordinator-orchestration/types'

export async function upsertVisitCoordinatorOrchestrationProjection(
  orchestration: VisitCoordinatorOrchestration,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'visit_coordinator_orchestration_projections',
      organizationId: orchestration.organizationId,
      studyId: orchestration.studyId,
      studySubjectId: orchestration.studySubjectId,
      visitId: orchestration.visitId,
    },
    async (supabase) => {
      const { error } = await supabase.from('visit_coordinator_orchestration_projections').upsert({
        visit_id: orchestration.visitId,
        organization_id: orchestration.organizationId,
        study_id: orchestration.studyId,
        study_subject_id: orchestration.studySubjectId,
        computed_at: orchestration.computedAt,
        orchestration_version: orchestration.orchestrationVersion,
        next_actions: orchestration.nextActions,
        priority_scores: orchestration.priorityScores,
        urgency: orchestration.urgency,
        blocker_chains: orchestration.blockerChains,
        work_queue: orchestration.workQueue,
        visit_execution: orchestration.visitExecution,
        top_priority_score: orchestration.topPriorityScore,
        action_now_count: orchestration.workQueue.actionNow.length,
        escalation_count: orchestration.workQueue.escalation.length,
        pi_review_count: orchestration.workQueue.piReview.length,
        snapshot: orchestration.snapshot,
      })
      return { error }
    },
  )
}

export async function upsertSubjectCoordinatorOrchestrationProjection(
  orchestration: SubjectCoordinatorOrchestration,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'subject_coordinator_orchestration_projections',
      organizationId: orchestration.organizationId,
      studyId: orchestration.studyId,
      studySubjectId: orchestration.studySubjectId,
    },
    async (supabase) => {
      const { error } = await supabase.from('subject_coordinator_orchestration_projections').upsert({
        study_subject_id: orchestration.studySubjectId,
        organization_id: orchestration.organizationId,
        study_id: orchestration.studyId,
        computed_at: orchestration.computedAt,
        orchestration_version: orchestration.orchestrationVersion,
        next_actions: orchestration.nextActions,
        priority_scores: orchestration.priorityScores,
        urgency: orchestration.urgency,
        blocker_chains: orchestration.blockerChains,
        work_queue: orchestration.workQueue,
        subject_escalation: orchestration.subjectEscalation,
        top_priority_score: orchestration.topPriorityScore,
        action_now_count: orchestration.workQueue.actionNow.length,
        escalation_count: orchestration.workQueue.escalation.length,
        snapshot: {
          ...orchestration.snapshot,
          financialLeakageEscalation: orchestration.financialLeakageEscalation,
        },
      })
      return { error }
    },
  )
}
