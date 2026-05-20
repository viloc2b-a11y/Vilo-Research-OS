import type { SafetySignalItem, SafetySignalSeverity } from '@/lib/subject/safety-signals/types'

const SAFETY_SEVERITY_RANK: Record<SafetySignalSeverity, number> = {
  error: 0,
  high: 1,
  warning: 2,
  info: 3,
  unknown: 4,
}

function extractProcedureLabel(title: string): string {
  const dash = title.indexOf('—')
  if (dash >= 0) return title.slice(0, dash).trim()
  return title.trim()
}

function procedureValidationKey(item: SafetySignalItem): string {
  const procLabel = extractProcedureLabel(item.title)
  const status = item.title.toLowerCase().includes('blocked') ? 'blocked' : 'incomplete'
  return `proc-val:${status}:${procLabel}`
}

function visitCountLabel(count: number): string {
  return `${count} visit${count === 1 ? '' : 's'}`
}

function mergeDescription(base: string | null, visitCount: number): string {
  const prefix = visitCountLabel(visitCount)
  if (!base?.trim()) return prefix
  return `${prefix} · ${base}`
}

export function sortSafetySignalsBySeverity(items: SafetySignalItem[]): SafetySignalItem[] {
  return [...items].sort((a, b) => {
    const sa = SAFETY_SEVERITY_RANK[a.severity] ?? 5
    const sb = SAFETY_SEVERITY_RANK[b.severity] ?? 5
    if (sa !== sb) return sa - sb
    if (a.isUnresolved !== b.isUnresolved) return a.isUnresolved ? -1 : 1
    const ta = new Date(a.occurredAt).getTime()
    const tb = new Date(b.occurredAt).getTime()
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
  })
}

/**
 * Group repeated procedure validation rows (e.g. CBC incomplete on many visits)
 * and drop resolved validation findings from the active scan list.
 */
export function collapseSafetySignals(items: SafetySignalItem[]): SafetySignalItem[] {
  const procedureBuckets = new Map<string, SafetySignalItem[]>()
  const active: SafetySignalItem[] = []

  for (const item of items) {
    if (item.kind === 'validation_finding' && !item.isUnresolved) {
      continue
    }

    if (item.kind !== 'procedure_validation') {
      active.push(item)
      continue
    }

    const key = procedureValidationKey(item)
    const bucket = procedureBuckets.get(key) ?? []
    bucket.push(item)
    procedureBuckets.set(key, bucket)
  }

  for (const [key, group] of procedureBuckets) {
    if (group.length === 1) {
      active.push(group[0])
      continue
    }

    const lead = group.reduce((best, cur) => {
      const bestRank = SAFETY_SEVERITY_RANK[best.severity] ?? 5
      const curRank = SAFETY_SEVERITY_RANK[cur.severity] ?? 5
      return curRank < bestRank ? cur : best
    })

    active.push({
      ...lead,
      id: key,
      visitId: null,
      visitName: visitCountLabel(group.length),
      description: mergeDescription(lead.description, group.length),
    })
  }

  return sortSafetySignalsBySeverity(active)
}
