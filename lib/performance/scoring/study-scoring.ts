import type { OperationalState, ScoredStudy, StudyHealthInput } from '@/lib/performance/scoring/types'
import { STATE_PRIORITY_RANK } from '@/lib/performance/scoring/types'

export function scoreStudyHealth(input: StudyHealthInput): ScoredStudy {
  const operationalState = resolveStudyOperationalState(input)
  return {
    studyId: input.studyId,
    operationalState,
    priorityRank: STATE_PRIORITY_RANK[operationalState],
  }
}

export function resolveStudyOperationalState(input: StudyHealthInput): OperationalState {
  if (input.blockedProcedureCount > 0 || input.missedVisitCount > 2) {
    return 'critical'
  }
  if (input.openQueryCount > 5 || input.openFindingsCount > 3) {
    return 'risk'
  }
  if (
    input.unsignedOver48hCount > 0 ||
    input.visitsClosingWindowToday > 0 ||
    input.staleStudyFlag
  ) {
    return 'watch'
  }
  return 'healthy'
}

export function scoreStudyHealthRows(inputs: StudyHealthInput[]): ScoredStudy[] {
  return inputs.map((input) => scoreStudyHealth(input))
}
