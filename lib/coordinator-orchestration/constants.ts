export const COORDINATOR_ORCHESTRATION_VERSION = 1

export const PRIORITY_WEIGHTS = {
  patientSafetyRisk: 0.28,
  protocolRisk: 0.18,
  visitTimelinePressure: 0.16,
  coordinatorBurden: 0.12,
  unresolvedGovernance: 0.14,
  financialLeakage: 0.12,
} as const

export const URGENCY_THRESHOLDS = {
  critical: 80,
  high: 60,
  moderate: 35,
} as const
