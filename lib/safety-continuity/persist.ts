import { persistDerivedProjectionSafe } from '@/lib/projections/runtime-projection-persist'
import type { SubjectSafetyContinuity, VisitSafetyCarryForward } from '@/lib/safety-continuity/types'

export async function upsertSubjectSafetyContinuityProjection(
  continuity: SubjectSafetyContinuity,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'subject_safety_continuity_projections',
      organizationId: continuity.organizationId,
      studyId: continuity.studyId,
      studySubjectId: continuity.studySubjectId,
    },
    async (supabase) => {
      const { error } = await supabase.from('subject_safety_continuity_projections').upsert({
        study_subject_id: continuity.studySubjectId,
        organization_id: continuity.organizationId,
        study_id: continuity.studyId,
        computed_at: continuity.computedAt,
        projection_version: continuity.projectionVersion,
        continuity_state: continuity.continuityState,
        carry_forward_active: continuity.carryForwardActive,
        unresolved_ae_count: continuity.unresolvedAeCount,
        open_safety_workflow_count: continuity.openSafetyWorkflowCount,
        critical_finding_count: continuity.criticalFindingCount,
        unresolved_items: continuity.unresolvedItems,
        source_refs: continuity.sourceRefs,
        snapshot: continuity.snapshot,
      })
      return { error }
    },
  )
}

export async function upsertVisitSafetyCarryForwardProjection(
  carryForward: VisitSafetyCarryForward,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'visit_safety_carryforward_projections',
      organizationId: carryForward.organizationId,
      studyId: carryForward.studyId,
      studySubjectId: carryForward.studySubjectId,
      visitId: carryForward.visitId,
    },
    async (supabase) => {
      const { error } = await supabase.from('visit_safety_carryforward_projections').upsert({
        visit_id: carryForward.visitId,
        organization_id: carryForward.organizationId,
        study_id: carryForward.studyId,
        study_subject_id: carryForward.studySubjectId,
        computed_at: carryForward.computedAt,
        projection_version: carryForward.projectionVersion,
        subject_continuity_state: carryForward.subjectContinuityState,
        carried_ae_count: carryForward.carriedAeCount,
        visit_linked_ae_count: carryForward.visitLinkedAeCount,
        carry_forward_active: carryForward.carryForwardActive,
        blockers: carryForward.blockers,
        snapshot: carryForward.snapshot,
      })
      return { error }
    },
  )
}
