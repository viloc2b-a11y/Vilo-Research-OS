import type { SubjectEscalationOrchestration } from '@/lib/coordinator-orchestration/types'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'

export function orchestrateSubjectEscalation(input: {
  subject: SubjectRuntimeProjection
  visitOrchestrations: VisitCoordinatorOrchestration[]
}): SubjectEscalationOrchestration {
  const reasons: string[] = []
  let criticalVisitCount = 0

  for (const v of input.visitOrchestrations) {
    if (v.urgency.level === 'critical' || v.urgency.level === 'high') {
      criticalVisitCount += 1
      reasons.push(`Visit ${v.visitId.slice(0, 8)}: ${v.urgency.drivers[0] ?? v.urgency.level}`)
    }
  }

  if (input.subject.unresolvedSafetyCount > 0) {
    reasons.push(`${input.subject.unresolvedSafetyCount} unresolved safety item(s)`)
  }
  if (input.subject.missedVisitCount > 0) {
    reasons.push(`${input.subject.missedVisitCount} missed visit(s)`)
  }
  if (input.subject.operationalHealth === 'critical') {
    reasons.push('Subject operational health critical')
  }

  let escalationLevel: SubjectEscalationOrchestration['escalationLevel'] = 'none'
  if (
    input.subject.operationalHealth === 'critical'
    || criticalVisitCount >= 2
    || input.subject.unresolvedSafetyCount >= 2
  ) {
    escalationLevel = 'critical'
  } else if (
    input.visitOrchestrations.some((v) => v.workQueue.piReview.length > 0)
    || reasons.some((r) => r.toLowerCase().includes('pi'))
  ) {
    escalationLevel = 'pi'
  } else if (criticalVisitCount > 0 || input.subject.missedVisitCount > 0) {
    escalationLevel = 'operational'
  } else if (input.subject.blockerCount > 0 || input.subject.pendingWorkflowCount > 0) {
    escalationLevel = 'coordinator'
  }

  return {
    escalationLevel,
    reasons: reasons.slice(0, 8),
    openVisitCount: input.subject.openVisitCount,
    criticalVisitCount,
  }
}
