import { persistDerivedProjectionSafe } from '@/lib/projections/runtime-projection-persist'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { StudyExecutionProjection } from '@/lib/projections/types'

export async function upsertVisitReadinessProjection(
  projection: VisitReadinessProjection,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'visit_readiness_projections',
      organizationId: projection.organizationId,
      studyId: projection.studyId,
      studySubjectId: projection.studySubjectId,
      visitId: projection.visitId,
    },
    async (supabase) => {
      const { error } = await supabase.from('visit_readiness_projections').upsert({
        visit_id: projection.visitId,
        organization_id: projection.organizationId,
        study_id: projection.studyId,
        study_subject_id: projection.studySubjectId,
        computed_at: projection.computedAt,
        projection_version: projection.projectionVersion,
        readiness_status: projection.readinessStatus,
        pending_procedure_count: projection.pendingProcedureCount,
        unsigned_procedure_count: projection.unsignedProcedureCount,
        unresolved_finding_count: projection.unresolvedFindingCount,
        missing_source_count: projection.missingSourceCount,
        safety_blocker_count: projection.safetyBlockerCount,
        visit_completion_ready: projection.visitCompletionReady,
        coordinator_sign_ready: projection.coordinatorSignReady,
        investigator_sign_ready: projection.investigatorSignReady,
        blocker_count: projection.blockerCount,
        blockers: projection.blockers,
        snapshot: projection.snapshot,
      })
      return { error }
    },
  )
}

export async function upsertSubjectRuntimeProjection(
  projection: SubjectRuntimeProjection,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'subject_runtime_projections',
      organizationId: projection.organizationId,
      studyId: projection.studyId,
      studySubjectId: projection.studySubjectId,
    },
    async (supabase) => {
      const { error } = await supabase.from('subject_runtime_projections').upsert({
        study_subject_id: projection.studySubjectId,
        organization_id: projection.organizationId,
        study_id: projection.studyId,
        computed_at: projection.computedAt,
        projection_version: projection.projectionVersion,
        longitudinal_state: projection.longitudinalState,
        operational_health: projection.operationalHealth,
        unresolved_safety_count: projection.unresolvedSafetyCount,
        missed_visit_count: projection.missedVisitCount,
        pending_workflow_count: projection.pendingWorkflowCount,
        incomplete_source_count: projection.incompleteSourceCount,
        open_visit_count: projection.openVisitCount,
        blocker_count: projection.blockerCount,
        blockers: projection.blockers,
        snapshot: projection.snapshot,
      })
      return { error }
    },
  )
}

export async function upsertStudyExecutionProjection(
  projection: StudyExecutionProjection,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'study_execution_projections',
      organizationId: projection.organizationId,
      studyId: projection.studyId,
    },
    async (supabase) => {
      const { error } = await supabase.from('study_execution_projections').upsert({
        study_id: projection.studyId,
        organization_id: projection.organizationId,
        computed_at: projection.computedAt,
        projection_version: projection.projectionVersion,
        operational_risk_level: projection.operationalRiskLevel,
        enrolled_subject_count: projection.enrolledSubjectCount,
        active_subject_count: projection.activeSubjectCount,
        incomplete_source_count: projection.incompleteSourceCount,
        open_workflow_count: projection.openWorkflowCount,
        open_query_count: projection.openQueryCount,
        missed_visit_count: projection.missedVisitCount,
        unresolved_safety_count: projection.unresolvedSafetyCount,
        protocol_execution_burden_score: projection.protocolExecutionBurdenScore,
        source_completion_burden_score: projection.sourceCompletionBurdenScore,
        blocker_count: projection.blockerCount,
        blockers: projection.blockers,
        snapshot: projection.snapshot,
      })
      return { error }
    },
  )
}
