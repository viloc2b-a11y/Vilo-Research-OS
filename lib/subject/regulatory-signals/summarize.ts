import type { RegulatorySignalItem, RegulatorySignalSummary } from '@/lib/subject/regulatory-signals/types'

export function summarizeRegulatorySignals(items: RegulatorySignalItem[]): RegulatorySignalSummary {
  let openUnresolved = 0
  let missedOowVisits = 0
  let blockedIncompleteProcedures = 0
  let unresolvedFindings = 0
  let overdueActions = 0

  for (const item of items) {
    if (item.isUnresolved) openUnresolved += 1
    if (
      item.signalType === 'missed_visit' ||
      item.signalType === 'out_of_window_visit'
    ) {
      missedOowVisits += 1
    }
    if (
      item.signalType === 'blocked_procedure' ||
      item.signalType === 'incomplete_procedure'
    ) {
      blockedIncompleteProcedures += 1
    }
    if (item.signalType === 'validation_finding') {
      unresolvedFindings += 1
    }
    if (item.signalType === 'overdue_workflow' && item.isUnresolved) {
      overdueActions += 1
    }
  }

  return {
    total: items.length,
    openUnresolved,
    missedOowVisits,
    blockedIncompleteProcedures,
    unresolvedFindings,
    overdueActions,
  }
}

export function sortRegulatorySignals(items: RegulatorySignalItem[]): RegulatorySignalItem[] {
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  }

  return [...items].sort((a, b) => {
    const sa = severityRank[a.severity] ?? 4
    const sb = severityRank[b.severity] ?? 4
    if (sa !== sb) return sa - sb
    const ta = new Date(a.occurredAt).getTime()
    const tb = new Date(b.occurredAt).getTime()
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
  })
}
