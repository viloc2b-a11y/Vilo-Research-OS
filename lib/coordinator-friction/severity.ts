import type {
  CoordinatorFrictionObservation,
  CoordinatorFrictionSeverity,
} from '@/lib/coordinator-friction/types'

export function deriveFrictionSeverity(
  observation: CoordinatorFrictionObservation,
): CoordinatorFrictionSeverity {
  if (
    observation.operationalContinuityRisk
    && (
      observation.likelyWorkflowAbandonment
      || (observation.unresolvedBlockerCount ?? 0) >= 2
      || (observation.signatureDelayHours ?? 0) >= 48
    )
  ) {
    return 'critical_operational_friction'
  }

  if (
    observation.operationalContinuityRisk
    || observation.likelyWorkflowAbandonment
    || (observation.submissionFailureCount ?? 0) >= 3
    || (observation.stalledSourceMinutes ?? 0) >= 60
    || (observation.confusionReopenCount ?? 0) >= 3
  ) {
    return 'high'
  }

  if (
    observation.coordinatorConfusionRisk
    || (observation.navigationRepeats ?? 0) >= 3
    || (observation.workflowReturnCount ?? 0) >= 3
    || (observation.clickPathLength ?? 0) >= 10
  ) {
    return 'medium'
  }

  return 'low'
}

export function severityWeight(severity: CoordinatorFrictionSeverity): number {
  if (severity === 'critical_operational_friction') return 100
  if (severity === 'high') return 85
  if (severity === 'medium') return 55
  return 25
}
