import type { StudyPerformanceCard } from '@/app/(ops)/performance/_lib/performance-types'

export function formatCriticalIssues(card: StudyPerformanceCard): string {
  const parts: string[] = []
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
