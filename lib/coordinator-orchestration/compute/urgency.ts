import { URGENCY_THRESHOLDS } from '@/lib/coordinator-orchestration/constants'
import type { OperationalPriorityScores } from '@/lib/coordinator-orchestration/types'
import type { CoordinatorNextAction, RuntimeUrgency } from '@/lib/coordinator-orchestration/types'

export function computeRuntimeUrgency(input: {
  priorityScores: OperationalPriorityScores
  nextActions: CoordinatorNextAction[]
  readinessBlocked: boolean
  overdueWorkflowCount: number
}): RuntimeUrgency {
  const drivers: string[] = []
  const ps = input.priorityScores

  if (ps.patientSafetyRisk >= 50) drivers.push('patient/safety risk elevated')
  if (ps.protocolRisk >= 50) drivers.push('protocol friction')
  if (ps.visitTimelinePressure >= 50) drivers.push('visit timeline pressure')
  if (ps.financialLeakage >= 40) drivers.push('financial leakage')
  if (ps.unresolvedGovernance >= 40) drivers.push('governance unresolved')
  if (input.overdueWorkflowCount > 0) drivers.push('overdue workflow')

  const topAction = input.nextActions[0]
  if (topAction?.requiresPiReview) drivers.push('PI review required')
  if (topAction?.requiresEscalation) drivers.push('escalation required')

  let urgencyScore = ps.compositeScore
  if (input.readinessBlocked) urgencyScore = Math.min(100, urgencyScore + 12)
  if (input.nextActions.some((a) => a.kind === 'pi_review')) {
    urgencyScore = Math.min(100, urgencyScore + 8)
  }

  let level: RuntimeUrgency['level'] = 'low'
  if (urgencyScore >= URGENCY_THRESHOLDS.critical) level = 'critical'
  else if (urgencyScore >= URGENCY_THRESHOLDS.high) level = 'high'
  else if (urgencyScore >= URGENCY_THRESHOLDS.moderate) level = 'moderate'

  const slaPressure =
    ps.visitTimelinePressure >= 60
    || input.overdueWorkflowCount > 0
    || level === 'critical'

  return {
    level,
    urgencyScore: Math.round(urgencyScore),
    drivers: drivers.slice(0, 6),
    slaPressure,
  }
}
