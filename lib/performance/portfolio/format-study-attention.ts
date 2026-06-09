import type { StudyPerformanceCard } from '@/app/(ops)/performance/_lib/performance-types'

export function formatCriticalIssues(card: StudyPerformanceCard): string {
  const parts: string[] = []
  const daysLeft = enrollmentDaysLeft(card.enrollmentEndDate)
  const budgetEvidenceMissing =
    (card.budgetEvidenceDocumentCount ?? 0) + (card.contractEvidenceDocumentCount ?? 0) === 0
  const activeBudgetReferenceMissing =
    (card.activeBudgetReferenceCount ?? 0) + (card.activeContractReferenceCount ?? 0) === 0
  if (
    (card.financialLeakageCount ?? 0) > 0 &&
    (budgetEvidenceMissing || activeBudgetReferenceMissing)
  ) {
    parts.push(`financial risk lacks budget evidence`)
  }
  if (
    card.enrollmentTarget &&
    card.enrollmentTarget > 0 &&
    (card.randomizedCount ?? 0) < card.enrollmentTarget &&
    daysLeft !== null &&
    daysLeft <= 14
  ) {
    parts.push(`enrollment target at risk`)
  }
  if (card.blockedProcedureCount > 0) {
    parts.push(`${card.blockedProcedureCount} blocked`)
  }
  if (card.missedVisitCount > 0) {
    parts.push(`${card.missedVisitCount} missed`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function formatNeedsAttentionToday(card: StudyPerformanceCard): string {
  const parts: string[] = []
  const daysLeft = enrollmentDaysLeft(card.enrollmentEndDate)
  if ((card.budgetEvidenceDocumentCount ?? 0) + (card.contractEvidenceDocumentCount ?? 0) === 0) {
    parts.push('budget/CTA evidence missing')
  } else if (
    (card.activeBudgetReferenceCount ?? 0) + (card.activeContractReferenceCount ?? 0) ===
    0
  ) {
    parts.push('budget/CTA active reference missing')
  }
  if (
    card.enrollmentTarget &&
    card.enrollmentTarget > 0 &&
    (card.randomizedCount ?? 0) < card.enrollmentTarget &&
    daysLeft !== null &&
    daysLeft <= 30
  ) {
    parts.push(`${card.randomizedCount ?? 0}/${card.enrollmentTarget} randomized`)
  }
  if ((card.visitsClosingWindowToday ?? 0) > 0) {
    parts.push(`${card.visitsClosingWindowToday} visits closing window`)
  }
  if ((card.unsignedOver48hCount ?? 0) > 0) {
    parts.push(`${card.unsignedOver48hCount} unsigned > 48h`)
  }
  if (card.openQueryCount > 5) {
    parts.push(`${card.openQueryCount} open queries`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function enrollmentDaysLeft(date: string | null | undefined): number | null {
  if (!date) return null
  const time = new Date(date).getTime()
  if (Number.isNaN(time)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((time - today.getTime()) / (24 * 60 * 60 * 1000))
}
