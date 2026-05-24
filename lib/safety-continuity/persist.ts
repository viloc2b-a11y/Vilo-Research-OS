import type { SubjectSafetyContinuity, VisitSafetyCarryForward } from '@/lib/safety-continuity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertSubjectSafetyContinuityProjection(
  supabase: SupabaseClient,
  continuity: SubjectSafetyContinuity,
): Promise<void> {
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

  if (error) throw new Error(error.message)
}

export async function upsertVisitSafetyCarryForwardProjection(
  supabase: SupabaseClient,
  carryForward: VisitSafetyCarryForward,
): Promise<void> {
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

  if (error) throw new Error(error.message)
}
