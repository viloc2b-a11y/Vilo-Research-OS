import { PRIORITY_WEIGHTS } from '@/lib/coordinator-orchestration/constants'
import type { VisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import type { OperationalPriorityScores } from '@/lib/coordinator-orchestration/types'

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function computeOperationalPriorityScores(
  ctx: VisitOrchestrationContext,
): OperationalPriorityScores {
  const r = ctx.readiness
  const oi = ctx.operationalIntelligence
  const fin = ctx.financialRuntime

  const patientSafetyRisk = clamp(
    r.safetyBlockerCount * 25 + (oi.riskLevel === 'critical' ? 40 : oi.riskLevel === 'elevated' ? 25 : 0),
  )

  const protocolRisk = clamp(
    (oi.frictionScore ?? 0) * 0.4
    + r.blockers.filter((b) => b.category === 'protocol_graph').length * 20,
  )

  const visitStatus = (r.snapshot.visitStatus as string | undefined) ?? ''
  const scheduledDate = (r.snapshot.scheduledDate as string | undefined) ?? null
  let timelinePressure = 0
  if (scheduledDate) {
    const days = Math.floor(
      (Date.parse(scheduledDate) - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (days < 0) timelinePressure = 70
    else if (days <= 2) timelinePressure = 50
    else if (days <= 7) timelinePressure = 25
  }
  if (visitStatus === 'missed' || visitStatus === 'overdue') timelinePressure = 90
  const visitTimelinePressure = clamp(timelinePressure + ctx.rescheduleCount * 8)

  const coordinatorBurden = clamp(oi.burdenScore ?? 0)

  const unresolvedGovernance = clamp(
    r.blockers.filter((b) => b.category === 'governance').length * 22
    + (oi.signalCount ?? 0) * 5,
  )

  const financialLeakage = clamp(fin.leakageScore ?? 0)

  const compositeScore = clamp(
    patientSafetyRisk * PRIORITY_WEIGHTS.patientSafetyRisk
    + protocolRisk * PRIORITY_WEIGHTS.protocolRisk
    + visitTimelinePressure * PRIORITY_WEIGHTS.visitTimelinePressure
    + coordinatorBurden * PRIORITY_WEIGHTS.coordinatorBurden
    + unresolvedGovernance * PRIORITY_WEIGHTS.unresolvedGovernance
    + financialLeakage * PRIORITY_WEIGHTS.financialLeakage,
  )

  return {
    patientSafetyRisk,
    protocolRisk,
    visitTimelinePressure,
    coordinatorBurden,
    unresolvedGovernance,
    financialLeakage,
    compositeScore,
  }
}
