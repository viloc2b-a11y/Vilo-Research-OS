import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

export type VisitAutomationContext = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  readiness: VisitReadinessProjection
  orchestration: VisitCoordinatorOrchestration
  rescheduleCount: number
  overdueWorkflowCount: number
  replayFrictionDetected: boolean
}

export function buildVisitAutomationContext(input: {
  readiness: VisitReadinessProjection
  orchestration: VisitCoordinatorOrchestration
  rescheduleCount?: number
  overdueWorkflowCount?: number
}): VisitAutomationContext {
  const snap = input.readiness.snapshot
  const replaySummary = (snap.replayBlockedSummary as string | undefined) ?? ''
  const oi = snap.operationalIntelligence as { burdenScore?: number } | undefined

  return {
    visitId: input.readiness.visitId,
    organizationId: input.readiness.organizationId,
    studyId: input.readiness.studyId,
    studySubjectId: input.readiness.studySubjectId,
    readiness: input.readiness,
    orchestration: input.orchestration,
    rescheduleCount: input.rescheduleCount ?? 0,
    overdueWorkflowCount: input.overdueWorkflowCount ?? 0,
    replayFrictionDetected:
      replaySummary.length > 0
      || (oi?.burdenScore ?? 0) >= 60
      || input.orchestration.workQueue.blocked.length >= 2,
  }
}
