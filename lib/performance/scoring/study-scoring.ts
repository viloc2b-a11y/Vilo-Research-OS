import type { OperationalState, ScoredStudy, StudyHealthInput, StudyRiskSignal } from '@/lib/performance/scoring/types'
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

/**
 * Evaluate the 3 new recruitment risk signals from PR2.
 * These never throw — returns an empty array when no data is available.
 */
export function resolveRecruitmentRiskSignals(input: StudyHealthInput): StudyRiskSignal[] {
  const signals: StudyRiskSignal[] = []

  // Signal 1: Recruitment Funnel Stall
  if (input.recruitmentFunnelStall === true) {
    signals.push({
      type: 'recruitment_funnel_stall',
      severity: 'risk',
      message: 'No lead stage movement in 14+ days',
    })
  }

  // Signal 2: Pipeline Depth Risk
  const qualifiedDepth = input.qualifiedPipelineDepth ?? 0
  const subjectsRemaining = input.subjectsRemaining ?? (
    (input.enrollmentTarget ?? 0) - (input.randomizedCount ?? 0)
  )
  if (subjectsRemaining > 0 && qualifiedDepth < subjectsRemaining * 1.5) {
    signals.push({
      type: 'pipeline_depth_risk',
      severity: 'critical',
      message: 'Pipeline depth below safe threshold',
    })
  }

  // Signal 3: Source Concentration Risk
  if (input.sourceConcentrationRisk === true) {
    signals.push({
      type: 'source_concentration_risk',
      severity: 'watch',
      message: 'Over 80% of leads from single source',
    })
  }

  return signals
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

  // Recruitment risk signals (PR2) — escalate state when present
  const recruitmentSignals = resolveRecruitmentRiskSignals(input)
  const hasCriticalRecruitmentSignal = recruitmentSignals.some((s) => s.severity === 'critical')
  const hasRiskRecruitmentSignal = recruitmentSignals.some((s) => s.severity === 'risk')
  const hasWatchRecruitmentSignal = recruitmentSignals.some((s) => s.severity === 'watch')

  if (hasCriticalRecruitmentSignal) return 'critical'
  if (hasRiskRecruitmentSignal) return 'risk'

  if (
    (enrollmentBehindTarget && enrollmentDaysLeft !== null && enrollmentDaysLeft <= 30) ||
    budgetEvidenceMissing ||
    input.unsignedOver48hCount > 0 ||
    input.visitsClosingWindowToday > 0 ||
    input.staleStudyFlag ||
    hasWatchRecruitmentSignal
  ) {
    return 'watch'
  }
  return 'healthy'
}

export function scoreStudyHealthRows(inputs: StudyHealthInput[]): ScoredStudy[] {
  return inputs.map((input) => scoreStudyHealth(input))
}
