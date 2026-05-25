import { persistDerivedProjectionSafe } from '@/lib/projections/runtime-projection-persist'
import type {
  SubjectRuntimeAutomation,
  VisitRuntimeAutomation,
} from '@/lib/runtime-automation/types'

export async function upsertVisitRuntimeAutomationProjection(
  automation: VisitRuntimeAutomation,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'visit_runtime_automation_projections',
      organizationId: automation.organizationId,
      studyId: automation.studyId,
      studySubjectId: automation.studySubjectId,
      visitId: automation.visitId,
    },
    async (supabase) => {
      const { error } = await supabase.from('visit_runtime_automation_projections').upsert({
        visit_id: automation.visitId,
        organization_id: automation.organizationId,
        study_id: automation.studyId,
        study_subject_id: automation.studySubjectId,
        computed_at: automation.computedAt,
        automation_version: automation.automationVersion,
        automation_plan: automation.plan,
        triggered_rules: automation.plan.triggeredRules,
        proposed_actions: automation.plan.proposedActions,
        adapted_urgency: automation.plan.adaptedUrgency,
        overload_adaptation: automation.plan.overloadAdaptation,
        safeguards: automation.plan.safeguards,
        pending_apply_count: automation.pendingApplyCount,
        applied_count: automation.appliedCount,
        snapshot: automation.snapshot,
      })
      return { error }
    },
  )
}

export async function upsertSubjectRuntimeAutomationProjection(
  automation: SubjectRuntimeAutomation,
): Promise<void> {
  await persistDerivedProjectionSafe(
    {
      table: 'subject_runtime_automation_projections',
      organizationId: automation.organizationId,
      studyId: automation.studyId,
      studySubjectId: automation.studySubjectId,
    },
    async (supabase) => {
      const { error } = await supabase.from('subject_runtime_automation_projections').upsert({
        study_subject_id: automation.studySubjectId,
        organization_id: automation.organizationId,
        study_id: automation.studyId,
        computed_at: automation.computedAt,
        automation_version: automation.automationVersion,
        automation_plan: automation.plan,
        triggered_rules: automation.plan.triggeredRules,
        proposed_actions: automation.plan.proposedActions,
        adapted_urgency: automation.plan.adaptedUrgency,
        overload_adaptation: automation.plan.overloadAdaptation,
        safeguards: automation.plan.safeguards,
        pending_apply_count: automation.pendingApplyCount,
        snapshot: automation.snapshot,
      })
      return { error }
    },
  )
}
