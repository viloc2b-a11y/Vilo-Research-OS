import { computeVisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/compute-visit'
import { buildBlockerResolutionChains } from '@/lib/coordinator-orchestration/compute/blocker-chains'
import { computeOperationalPriorityScores } from '@/lib/coordinator-orchestration/compute/priority-score'
import { computeRuntimeUrgency } from '@/lib/coordinator-orchestration/compute/urgency'
import { buildVisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import { COORDINATOR_ORCHESTRATION_VERSION } from '@/lib/coordinator-orchestration/constants'
import { orchestrateFinancialLeakageEscalation } from '@/lib/coordinator-orchestration/orchestrate/financial-leakage'
import { orchestrateSubjectEscalation } from '@/lib/coordinator-orchestration/orchestrate/subject-escalation'
import { deriveWorkQueue } from '@/lib/coordinator-orchestration/queue/derive-work-queue'
import type {
  SubjectCoordinatorOrchestration,
  VisitCoordinatorOrchestration,
} from '@/lib/coordinator-orchestration/types'
import type { SubjectRuntimeProjection, VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeSubjectCoordinatorOrchestration(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  subject: SubjectRuntimeProjection
}): Promise<SubjectCoordinatorOrchestration> {
  const { data: visitRows } = await input.supabase
    .from('visit_coordinator_orchestration_projections')
    .select('visit_id, next_actions, priority_scores, urgency, work_queue, top_priority_score')
    .eq('study_subject_id', input.studySubjectId)
    .order('top_priority_score', { ascending: false })
    .limit(20)

  const visitOrchestrations: VisitCoordinatorOrchestration[] = []
  const allActions = []

  if ((visitRows ?? []).length > 0) {
    for (const row of visitRows ?? []) {
      const cached = row as {
        visit_id: string
        next_actions: VisitCoordinatorOrchestration['nextActions']
        priority_scores: VisitCoordinatorOrchestration['priorityScores']
        urgency: VisitCoordinatorOrchestration['urgency']
        work_queue: VisitCoordinatorOrchestration['workQueue']
        top_priority_score: number
      }
      visitOrchestrations.push({
        visitId: cached.visit_id,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.studySubjectId,
        computedAt: new Date().toISOString(),
        orchestrationVersion: COORDINATOR_ORCHESTRATION_VERSION,
        nextActions: cached.next_actions ?? [],
        priorityScores: cached.priority_scores,
        urgency: cached.urgency,
        blockerChains: [],
        workQueue: cached.work_queue,
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
        topPriorityScore: cached.top_priority_score ?? 0,
        snapshot: {},
      })
      allActions.push(...(cached.next_actions ?? []))
    }
  } else {
    const { data: visits } = await input.supabase
      .from('visits')
      .select('id')
      .eq('study_subject_id', input.studySubjectId)
      .eq('organization_id', input.organizationId)
      .not('visit_status', 'in', '("completed","cancelled")')
      .limit(12)

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

      const orch = await computeVisitCoordinatorOrchestration({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: v.id as string,
        readiness,
      })
      if (!orch) continue
      visitOrchestrations.push(orch)
      allActions.push(...orch.nextActions)
    }
  }

  const topVisit = visitOrchestrations[0]
  const ctx = topVisit
    ? buildVisitOrchestrationContext({ readiness: {
        visitId: topVisit.visitId,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.studySubjectId,
        computedAt: new Date().toISOString(),
        projectionVersion: 1,
        readinessStatus: (topVisit.snapshot.readinessStatus as VisitReadinessProjection['readinessStatus']) ?? 'unknown',
        pendingProcedureCount: 0,
        unsignedProcedureCount: 0,
        unresolvedFindingCount: 0,
        missingSourceCount: 0,
        safetyBlockerCount: input.subject.unresolvedSafetyCount,
        visitCompletionReady: false,
        coordinatorSignReady: false,
        investigatorSignReady: false,
        blockerCount: input.subject.blockerCount,
        blockers: input.subject.blockers,
        snapshot: input.subject.snapshot,
      } })
    : buildVisitOrchestrationContext({
        readiness: {
          visitId: 'subject',
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
      })

  const priorityScores = topVisit?.priorityScores ?? computeOperationalPriorityScores(ctx)
  if (input.subject.unresolvedSafetyCount > 0) {
    priorityScores.patientSafetyRisk = Math.min(100, priorityScores.patientSafetyRisk + 15)
    priorityScores.compositeScore = Math.min(
      100,
      priorityScores.compositeScore + 10,
    )
  }

  const sortedActions = [...allActions].sort((a, b) => b.priority - a.priority).slice(0, 30)
  const urgency = computeRuntimeUrgency({
    priorityScores,
    nextActions: sortedActions,
    readinessBlocked: input.subject.operationalHealth === 'critical',
    overdueWorkflowCount: input.subject.pendingWorkflowCount,
  })

  const workQueue = deriveWorkQueue({
    nextActions: sortedActions,
    urgency,
    readiness: ctx.readiness,
  })

  const subjectEscalation = orchestrateSubjectEscalation({
    subject: input.subject,
    visitOrchestrations,
  })

  const leakageScore = visitOrchestrations.reduce(
    (sum, v) => sum + (v.financialLeakageEscalation.leakageScore ?? 0),
    0,
  )

  const financialLeakageEscalation = orchestrateFinancialLeakageEscalation({
    leakageItems: [],
    leakageScore: Math.min(100, Math.round(leakageScore / Math.max(1, visitOrchestrations.length))),
  })

  const blockerChains = buildBlockerResolutionChains({
    readiness: ctx.readiness,
    nextActions: sortedActions,
  })

  const topPriorityScore = Math.max(
    priorityScores.compositeScore,
    sortedActions[0]?.priority ?? 0,
    urgency.urgencyScore,
    ...visitOrchestrations.map((v) => v.topPriorityScore),
  )

  return {
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    computedAt: new Date().toISOString(),
    orchestrationVersion: COORDINATOR_ORCHESTRATION_VERSION,
    nextActions: sortedActions,
    priorityScores,
    urgency,
    blockerChains,
    workQueue,
    subjectEscalation,
    financialLeakageEscalation,
    topPriorityScore,
    snapshot: {
      visitOrchestrationCount: visitOrchestrations.length,
      escalationLevel: subjectEscalation.escalationLevel,
      actionNowCount: workQueue.actionNow.length,
    },
  }
}
