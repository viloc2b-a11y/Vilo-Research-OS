/**
 * Phase 5 — Operational intelligence (runtime-emergent metrics, not BI).
 */

export const OPERATIONAL_INTELLIGENCE_VERSION = 1

export type CoordinatorBurdenMetrics = {
  openWorkflowCount: number
  openQueryCount: number
  unresolvedFindingCount: number
  sourceBacklogCount: number
  safetyBurdenCount: number
  queryDensity: number
  rescheduleCount: number
  overdueWorkflowCount: number
  burdenScore: number
}

export type VisitComplexityMetrics = {
  procedureCount: number
  activeProcedureCount: number
  dependencyCount: number
  conditionalBranchCount: number
  safetyEscalationCount: number
  unresolvedBlockerCount: number
  complexityScore: number
}

export type ProtocolFrictionMetrics = {
  repeatedBlockerPatternCount: number
  graphEscalationCount: number
  unresolvedWorkflowRecurrence: number
  highBurdenVisitCount: number
  deviationSignalCount: number
  frictionScore: number
}

export type RuntimeRiskLevel = 'low' | 'moderate' | 'elevated' | 'critical'

export type RuntimeRiskMetrics = {
  riskLevel: RuntimeRiskLevel
  unresolvedRiskScore: number
  operationalInstabilityScore: number
  deviationPressureScore: number
  coordinatorOverloadScore: number
  riskScore: number
  riskFactors: string[]
}

export type OperationalIntelligenceSignal = {
  id: string
  kind:
    | 'coordinator_overload'
    | 'visit_complexity_high'
    | 'protocol_friction'
    | 'risk_elevated'
    | 'workflow_friction'
  severity: 'info' | 'warning' | 'critical'
  label: string
  detail: string
}

export type VisitOperationalIntelligence = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  intelligenceVersion: number
  coordinatorBurden: CoordinatorBurdenMetrics
  visitComplexity: VisitComplexityMetrics
  protocolFriction: ProtocolFrictionMetrics
  runtimeRisk: RuntimeRiskMetrics
  signals: OperationalIntelligenceSignal[]
  snapshot: Record<string, unknown>
}

export type SubjectOperationalIntelligence = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  intelligenceVersion: number
  coordinatorBurden: CoordinatorBurdenMetrics
  visitComplexityAggregate: {
    averageComplexityScore: number
    maxComplexityScore: number
    highComplexityVisitCount: number
  }
  protocolFriction: ProtocolFrictionMetrics
  runtimeRisk: RuntimeRiskMetrics
  signals: OperationalIntelligenceSignal[]
  snapshot: Record<string, unknown>
}
