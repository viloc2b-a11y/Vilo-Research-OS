import type {
  CoordinatorBurdenMetrics,
  ProtocolFrictionMetrics,
  RuntimeRiskLevel,
  RuntimeRiskMetrics,
  VisitComplexityMetrics,
} from '@/lib/operational-intelligence/types'

export function computeRuntimeRisk(input: {
  coordinatorBurden: CoordinatorBurdenMetrics
  visitComplexity?: VisitComplexityMetrics
  protocolFriction: ProtocolFrictionMetrics
  unresolvedBlockerCount?: number
}): RuntimeRiskMetrics {
  const riskFactors: string[] = []

  if (input.coordinatorBurden.safetyBurdenCount > 0) {
    riskFactors.push(`${input.coordinatorBurden.safetyBurdenCount} open safety item(s)`)
  }
  if (input.coordinatorBurden.unresolvedFindingCount > 0) {
    riskFactors.push(`${input.coordinatorBurden.unresolvedFindingCount} unresolved finding(s)`)
  }
  if (input.coordinatorBurden.overdueWorkflowCount > 0) {
    riskFactors.push(`${input.coordinatorBurden.overdueWorkflowCount} overdue workflow(s)`)
  }
  if (input.protocolFriction.deviationSignalCount > 0) {
    riskFactors.push(`${input.protocolFriction.deviationSignalCount} deviation signal(s)`)
  }
  if ((input.unresolvedBlockerCount ?? 0) > 2) {
    riskFactors.push(`${input.unresolvedBlockerCount} active blockers`)
  }

  const unresolvedRiskScore = Math.min(
    100,
    input.coordinatorBurden.safetyBurdenCount * 15
      + input.coordinatorBurden.unresolvedFindingCount * 12
      + (input.unresolvedBlockerCount ?? 0) * 10,
  )

  const operationalInstabilityScore = Math.min(
    100,
    input.coordinatorBurden.rescheduleCount * 8
      + input.coordinatorBurden.openWorkflowCount * 5
      + (input.visitComplexity?.safetyEscalationCount ?? 0) * 10,
  )

  const deviationPressureScore = Math.min(
    100,
    input.protocolFriction.deviationSignalCount * 20
      + input.protocolFriction.frictionScore * 0.4,
  )

  const coordinatorOverloadScore = Math.min(100, input.coordinatorBurden.burdenScore)

  const riskScore = Math.min(
    100,
    Math.round(
      unresolvedRiskScore * 0.35
        + operationalInstabilityScore * 0.2
        + deviationPressureScore * 0.25
        + coordinatorOverloadScore * 0.2,
    ),
  )

  let riskLevel: RuntimeRiskLevel = 'low'
  if (riskScore >= 70 || input.coordinatorBurden.safetyBurdenCount >= 2) {
    riskLevel = 'critical'
  } else if (riskScore >= 45) {
    riskLevel = 'elevated'
  } else if (riskScore >= 25) {
    riskLevel = 'moderate'
  }

  return {
    riskLevel,
    unresolvedRiskScore,
    operationalInstabilityScore,
    deviationPressureScore,
    coordinatorOverloadScore,
    riskScore,
    riskFactors,
  }
}
