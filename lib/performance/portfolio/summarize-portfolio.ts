import type { OperationalState } from '@/lib/performance/scoring/types'
import type { StudyPerformanceCard } from '@/app/(ops)/performance/_lib/performance-types'

export type PortfolioStateSummary = {
  critical: number
  risk: number
  watch: number
  healthy: number
}

export function summarizeStudyPortfolio(cards: StudyPerformanceCard[]): PortfolioStateSummary {
  const summary: PortfolioStateSummary = {
    critical: 0,
    risk: 0,
    watch: 0,
    healthy: 0,
  }

  for (const card of cards) {
    const state: OperationalState = card.operationalState ?? 'healthy'
    summary[state]++
  }

  return summary
}

export function formatPortfolioBanner(summary: PortfolioStateSummary): string {
  const parts: string[] = []
  if (summary.critical > 0) parts.push(`${summary.critical} critical`)
  if (summary.risk > 0) parts.push(`${summary.risk} risk`)
  if (summary.watch > 0) parts.push(`${summary.watch} watch`)
  if (summary.healthy > 0) parts.push(`${summary.healthy} healthy`)
  return parts.length > 0 ? parts.join(' · ') : 'No studies in scope'
}
