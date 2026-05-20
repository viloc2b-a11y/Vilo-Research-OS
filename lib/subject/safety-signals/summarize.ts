import type { SafetySignalItem, SafetySignalSummary } from '@/lib/subject/safety-signals/types'

const RECENT_DAYS = 14

function daysAgo(iso: string, ref: Date): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (ref.getTime() - t) / (1000 * 60 * 60 * 24)
}

export function summarizeSafetySignals(
  items: SafetySignalItem[],
  refDate = new Date(),
): SafetySignalSummary {
  let openUnresolved = 0
  let seriousHigh = 0
  let recentUpdated = 0
  let missingFollowUp = 0

  for (const item of items) {
    if (item.isUnresolved) openUnresolved += 1
    if (
      item.isUnresolved &&
      (item.severity === 'error' || item.severity === 'high')
    ) {
      seriousHigh += 1
    }
    if (daysAgo(item.occurredAt, refDate) <= RECENT_DAYS) recentUpdated += 1
    if (item.missingFollowUp) missingFollowUp += 1
  }

  return {
    total: items.length,
    openUnresolved,
    seriousHigh,
    recentUpdated,
    missingFollowUp,
  }
}

export function sortSafetySignals(items: SafetySignalItem[]): SafetySignalItem[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime()
    const tb = new Date(b.occurredAt).getTime()
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
  })
}
