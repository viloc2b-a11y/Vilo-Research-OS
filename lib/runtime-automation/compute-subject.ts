import { computeVisitRuntimeAutomation } from '@/lib/runtime-automation/compute-visit'
import { buildVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/plan/build-plan'
import { buildVisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { RUNTIME_AUTOMATION_VERSION } from '@/lib/runtime-automation/constants'
import type { SubjectRuntimeAutomation, VisitRuntimeAutomation } from '@/lib/runtime-automation/types'
import type { SubjectRuntimeProjection, VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeSubjectRuntimeAutomation(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  subject: SubjectRuntimeProjection
}): Promise<SubjectRuntimeAutomation> {
  const { data: visitAutomations } = await input.supabase
    .from('visit_runtime_automation_projections')
    .select('visit_id, automation_plan, pending_apply_count')
    .eq('study_subject_id', input.studySubjectId)
    .order('pending_apply_count', { ascending: false })
    .limit(15)

  const visitPlans: VisitRuntimeAutomation[] = []

  if ((visitAutomations ?? []).length > 0) {
    for (const row of visitAutomations ?? []) {
      visitPlans.push({
        visitId: row.visit_id as string,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.studySubjectId,
        computedAt: new Date().toISOString(),
        automationVersion: RUNTIME_AUTOMATION_VERSION,
        plan: row.automation_plan as SubjectRuntimeAutomation['plan'],
        pendingApplyCount: (row.pending_apply_count as number) ?? 0,
        appliedCount: 0,
        snapshot: {},
      })
    }
  } else {
    const { data: visits } = await input.supabase
      .from('visits')
      .select('id')
      .eq('study_subject_id', input.studySubjectId)
      .limit(8)

    for (const v of visits ?? []) {
      const { data: readinessRow } = await input.supabase
        .from('visit_readiness_projections')
        .select('*')
        .eq('visit_id', v.id)
        .maybeSingle()

      if (!readinessRow) continue

      const readiness: VisitReadinessProjection = {
        visitId: readinessRow.visit_id as string,
        organizationId: readinessRow.organization_id as string,
        studyId: readinessRow.study_id as string,
        studySubjectId: readinessRow.study_subject_id as string,
        computedAt: readinessRow.computed_at as string,
        projectionVersion: readinessRow.projection_version as number,
        readinessStatus: readinessRow.readiness_status as VisitReadinessProjection['readinessStatus'],
        pendingProcedureCount: readinessRow.pending_procedure_count as number,
        unsignedProcedureCount: readinessRow.unsigned_procedure_count as number,
        unresolvedFindingCount: readinessRow.unresolved_finding_count as number,
        missingSourceCount: readinessRow.missing_source_count as number,
        safetyBlockerCount: readinessRow.safety_blocker_count as number,
        visitCompletionReady: readinessRow.visit_completion_ready as boolean,
        coordinatorSignReady: readinessRow.coordinator_sign_ready as boolean,
        investigatorSignReady: readinessRow.investigator_sign_ready as boolean,
        blockerCount: readinessRow.blocker_count as number,
        blockers: (readinessRow.blockers as VisitReadinessProjection['blockers']) ?? [],
        snapshot: (readinessRow.snapshot as Record<string, unknown>) ?? {},
      }

      const auto = await computeVisitRuntimeAutomation({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: v.id as string,
        readiness,
      })
      if (auto) visitPlans.push(auto)
    }
  }

  const mergedTriggered = visitPlans.flatMap((v) => v.plan.triggeredRules)
  const mergedProposed = visitPlans
    .flatMap((v) => v.plan.proposedActions)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20)

  const topVisit = visitPlans[0]
  const ctx = topVisit
    ? buildVisitAutomationContext({
        readiness: {
          visitId: topVisit.visitId,
          organizationId: input.organizationId,
          studyId: input.studyId,
          studySubjectId: input.studySubjectId,
          computedAt: new Date().toISOString(),
          projectionVersion: 1,
          readinessStatus: 'unknown',
          pendingProcedureCount: 0,
          unsignedProcedureCount: 0,
          unresolvedFindingCount: 0,
          missingSourceCount: input.subject.incompleteSourceCount,
          safetyBlockerCount: input.subject.unresolvedSafetyCount,
          visitCompletionReady: false,
          coordinatorSignReady: false,
          investigatorSignReady: false,
          blockerCount: input.subject.blockerCount,
          blockers: input.subject.blockers,
          snapshot: input.subject.snapshot,
        },
        orchestration: {
          visitId: topVisit.visitId,
          organizationId: input.organizationId,
          studyId: input.studyId,
          studySubjectId: input.studySubjectId,
          computedAt: new Date().toISOString(),
          orchestrationVersion: 1,
          nextActions: [],
          priorityScores: {
            patientSafetyRisk: 0,
            protocolRisk: 0,
            visitTimelinePressure: 0,
            coordinatorBurden: 0,
            unresolvedGovernance: 0,
            financialLeakage: 0,
            compositeScore: 0,
          },
          urgency: { level: 'moderate', urgencyScore: 50, drivers: [], slaPressure: false },
          blockerChains: [],
          workQueue: {
            actionNow: [],
            canWait: [],
            blocked: [],
            escalation: [],
            piReview: [],
            coordinatorFollowUp: [],
          },
          visitExecution: {
            phase: 'in_visit',
            primaryObjective: '',
            pendingProcedureCount: 0,
            signoffBlocked: false,
            graphBlocked: false,
            recommendedSequence: [],
          },
          financialLeakageEscalation: {
            leakageScore: 0,
            criticalLeakageCount: 0,
            topLeakageKinds: [],
            recommendedActions: [],
          },
          topPriorityScore: 0,
          snapshot: {},
        },
      })
    : null

  const plan = ctx
    ? buildVisitRuntimeAutomationPlan(ctx)
    : {
        planId: `plan:subject:${input.studySubjectId}`,
        triggeredRules: mergedTriggered.slice(0, 10),
        proposedActions: mergedProposed,
        adaptedUrgency: {
          baseUrgencyScore: 0,
          adaptedUrgencyScore: 0,
          urgencyBoost: 0,
          adaptationReasons: [],
        },
        overloadAdaptation: {
          overloadDetected: false,
          burdenScore: 0,
          throttleProposedActions: false,
          maxActionsPerCycle: 12,
          adaptationNote: null,
        },
        safeguards: [],
        coordinatorSupervised: true,
      }

  if (mergedProposed.length > 0) {
    plan.proposedActions = mergedProposed
    plan.triggeredRules = mergedTriggered.slice(0, 12)
  }

  return {
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    computedAt: new Date().toISOString(),
    automationVersion: RUNTIME_AUTOMATION_VERSION,
    plan,
    pendingApplyCount: plan.proposedActions.filter((a) => a.status === 'proposed').length,
    snapshot: {
      visitAutomationCount: visitPlans.length,
      subjectHealth: input.subject.operationalHealth,
    },
  }
}
