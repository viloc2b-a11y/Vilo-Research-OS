import type {
  CoordinatorBurdenMetrics,
  OperationalIntelligenceSignal,
  ProtocolFrictionMetrics,
  RuntimeRiskMetrics,
  VisitComplexityMetrics,
} from '@/lib/operational-intelligence/types'

export function emitOperationalIntelligenceSignals(input: {
  coordinatorBurden: CoordinatorBurdenMetrics
  visitComplexity?: VisitComplexityMetrics
  protocolFriction: ProtocolFrictionMetrics
  runtimeRisk: RuntimeRiskMetrics
  scope: 'visit' | 'subject'
}): OperationalIntelligenceSignal[] {
  const signals: OperationalIntelligenceSignal[] = []

  if (input.coordinatorBurden.burdenScore >= 50) {
    signals.push({
      id: `${input.scope}:coordinator_overload`,
      kind: 'coordinator_overload',
      severity: input.coordinatorBurden.burdenScore >= 75 ? 'critical' : 'warning',
      label: 'Coordinator burden elevated',
      detail: `${input.coordinatorBurden.openWorkflowCount} workflow(s), ${input.coordinatorBurden.openQueryCount} query(ies), ${input.coordinatorBurden.sourceBacklogCount} source backlog.`,
    })
  }

  if (input.visitComplexity && input.visitComplexity.complexityScore >= 45) {
    signals.push({
      id: `${input.scope}:visit_complexity`,
      kind: 'visit_complexity_high',
      severity: input.visitComplexity.complexityScore >= 70 ? 'critical' : 'warning',
      label: 'High visit complexity',
      detail: `${input.visitComplexity.procedureCount} procedures, ${input.visitComplexity.unresolvedBlockerCount} blocker(s).`,
    })
  }

  if (input.protocolFriction.frictionScore >= 40) {
    signals.push({
      id: `${input.scope}:protocol_friction`,
      kind: 'protocol_friction',
      severity: 'warning',
      label: 'Protocol friction detected',
      detail: `${input.protocolFriction.deviationSignalCount} deviation signal(s), ${input.protocolFriction.graphEscalationCount} graph escalation(s).`,
    })
  }

  if (input.coordinatorBurden.overdueWorkflowCount > 0) {
    signals.push({
      id: `${input.scope}:workflow_friction`,
      kind: 'workflow_friction',
      severity: 'warning',
      label: 'Overdue workflow chains',
      detail: `${input.coordinatorBurden.overdueWorkflowCount} overdue item(s).`,
    })
  }

  if (input.runtimeRisk.riskLevel === 'elevated' || input.runtimeRisk.riskLevel === 'critical') {
    signals.push({
      id: `${input.scope}:runtime_risk`,
      kind: 'risk_elevated',
      severity: input.runtimeRisk.riskLevel === 'critical' ? 'critical' : 'warning',
      label: `Runtime risk ${input.runtimeRisk.riskLevel}`,
      detail: input.runtimeRisk.riskFactors.join('; ') || 'Accumulated operational risk.',
    })
  }

  return signals
}
