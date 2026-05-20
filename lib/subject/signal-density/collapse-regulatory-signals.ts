import type { RegulatorySignalItem, RegulatorySignalSeverity } from '@/lib/subject/regulatory-signals/types'

const SEVERITY_RANK: Record<RegulatorySignalSeverity, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  info: 3,
}

function visitCountLabel(count: number): string {
  return `${count} visit${count === 1 ? '' : 's'}`
}

function groupKey(item: RegulatorySignalItem): string | null {
  switch (item.signalType) {
    case 'pending_signature':
      return `sig:${item.title.trim()}`
    case 'incomplete_procedure':
    case 'blocked_procedure':
    case 'validation_finding':
      return `${item.signalType}:${item.title.trim()}`
    default:
      return null
  }
}

function pickLead(group: RegulatorySignalItem[]): RegulatorySignalItem {
  return group.reduce((best, cur) => {
    const bestRank = SEVERITY_RANK[best.severity] ?? 4
    const curRank = SEVERITY_RANK[cur.severity] ?? 4
    return curRank < bestRank ? cur : best
  })
}

export function collapseRegulatorySignals(items: RegulatorySignalItem[]): RegulatorySignalItem[] {
  const grouped = new Map<string, RegulatorySignalItem[]>()
  const passthrough: RegulatorySignalItem[] = []

  for (const item of items) {
    const key = groupKey(item)
    if (!key) {
      passthrough.push(item)
      continue
    }
    const bucket = grouped.get(key) ?? []
    bucket.push(item)
    grouped.set(key, bucket)
  }

  const collapsed: RegulatorySignalItem[] = [...passthrough]

  for (const [key, group] of grouped) {
    if (group.length === 1) {
      collapsed.push(group[0])
      continue
    }

    const lead = pickLead(group)
    collapsed.push({
      ...lead,
      id: `group-${key}`,
      visitId: null,
      visitName: visitCountLabel(group.length),
      description: lead.description
        ? `${visitCountLabel(group.length)} · ${lead.description}`
        : visitCountLabel(group.length),
    })
  }

  return collapsed
}
