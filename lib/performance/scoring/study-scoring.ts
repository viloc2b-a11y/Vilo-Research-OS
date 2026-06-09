import type { OperationalState, ScoredStudy, StudyHealthInput } from '@/lib/performance/scoring/types'
import { STATE_PRIORITY_RANK } from '@/lib/performance/scoring/types'

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const target = new Date(date).getTime()
  if (Number.isNaN(target)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today.getTime()) / (24 * 60 * 60 * 1000))
}

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
  const target = input.enrollmentTarget ?? null
  const randomized = input.randomizedCount ?? 0
  const enrollmentDaysLeft = daysUntil(input.enrollmentEndDate)
  const enrollmentBehindTarget = target !== null && target > 0 && randomized < target
  const budgetEvidenceCount =
    (input.budgetEvidenceDocumentCount ?? 0) + (input.contractEvidenceDocumentCount ?? 0)
  const activeBudgetReferenceCount =
    (input.activeBudgetReferenceCount ?? 0) + (input.activeContractReferenceCount ?? 0)
  const financialLeakagePresent = (input.financialLeakageCount ?? 0) > 0
  const budgetEvidenceMissing = budgetEvidenceCount === 0
  const activeBudgetReferenceMissing = activeBudgetReferenceCount === 0
  if (financialLeakagePresent && (budgetEvidenceMissing || activeBudgetReferenceMissing)) {
    return 'risk'
  }
  if (enrollmentBehindTarget && enrollmentDaysLeft !== null && enrollmentDaysLeft <= 14) {
    return 'risk'
  }
  if (input.openQueryCount > 5 || input.openFindingsCount > 3) {
    return 'risk'
  }
  if (
    (enrollmentBehindTarget && enrollmentDaysLeft !== null && enrollmentDaysLeft <= 30) ||
    budgetEvidenceMissing ||
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
