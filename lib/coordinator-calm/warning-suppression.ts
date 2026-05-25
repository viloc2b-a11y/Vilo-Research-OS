/**
 * Warning fatigue reduction — dedupe, TTL, low-risk suppression (site-internal).
 */

export type WarningSeverity = 'low' | 'medium' | 'high' | 'critical'

export type SuppressibleWarning = {
  id: string
  dedupeKey: string
  severity: WarningSeverity
  label: string
  kind: string
  priority: number
  /** Already acknowledged by coordinator — suppress low/medium repeats. */
  acknowledged?: boolean
  /** Active escalation — never suppress. */
  escalated?: boolean
  /** ISO timestamp for TTL evaluation. */
  firstSeenAt?: string | null
  /** Hours before stale informational warnings are hidden. */
  ttlHours?: number
  /** Low actionability FYI items. */
  informationalOnly?: boolean
}

export const DEFAULT_WARNING_TTL_HOURS = 48

const PRIORITY_KIND_PATTERNS = [
  { pattern: /block|unresolved|stalled|overdue/i, boost: 40 },
  { pattern: /sign|signature|signoff|pi|sub-i/i, boost: 35 },
  { pattern: /source|continuity|capture/i, boost: 30 },
  { pattern: /deviation|chronology|temporal/i, boost: 28 },
  { pattern: /stabiliz|sdv|inspection|readiness/i, boost: 25 },
]

function warningWeight(warning: SuppressibleWarning): number {
  let weight = warning.priority
  const text = `${warning.kind} ${warning.label}`
  for (const rule of PRIORITY_KIND_PATTERNS) {
    if (rule.pattern.test(text)) weight += rule.boost
  }
  if (warning.escalated) weight += 50
  if (warning.severity === 'critical') weight += 45
  if (warning.severity === 'high') weight += 30
  if (warning.severity === 'low') weight -= 25
  if (warning.informationalOnly) weight -= 40
  if (warning.acknowledged && warning.severity !== 'critical' && warning.severity !== 'high') {
    weight -= 35
  }
  return weight
}

function isStaleInformational(warning: SuppressibleWarning, nowMs: number): boolean {
  if (!warning.informationalOnly && warning.severity !== 'low') return false
  if (!warning.firstSeenAt) return false
  const ttlHours = warning.ttlHours ?? DEFAULT_WARNING_TTL_HOURS
  const ageMs = nowMs - Date.parse(warning.firstSeenAt)
  return Number.isFinite(ageMs) && ageMs > ttlHours * 60 * 60 * 1000
}

function shouldSuppressLowRisk(warning: SuppressibleWarning): boolean {
  if (warning.escalated) return false
  if (warning.severity === 'critical' || warning.severity === 'high') return false
  if (warning.acknowledged && warning.severity === 'low') return true
  if (warning.informationalOnly && warning.severity === 'low') return true
  return false
}

export type WarningSuppressionResult = {
  visible: SuppressibleWarning[]
  suppressedCount: number
  duplicateCollapsedCount: number
  staleSuppressedCount: number
  lowRiskSuppressedCount: number
}

export function suppressWarnings(
  warnings: SuppressibleWarning[],
  options?: { now?: Date },
): WarningSuppressionResult {
  const nowMs = (options?.now ?? new Date()).getTime()
  const byKey = new Map<string, SuppressibleWarning>()
  let duplicateCollapsedCount = 0
  let staleSuppressedCount = 0
  let lowRiskSuppressedCount = 0

  for (const warning of warnings) {
    if (isStaleInformational(warning, nowMs)) {
      staleSuppressedCount += 1
      continue
    }
    if (shouldSuppressLowRisk(warning)) {
      lowRiskSuppressedCount += 1
      continue
    }

    const key = warning.dedupeKey.trim().toLowerCase() || warning.id
    const existing = byKey.get(key)
    if (existing) {
      duplicateCollapsedCount += 1
      if (warningWeight(warning) > warningWeight(existing)) {
        byKey.set(key, warning)
      }
      continue
    }
    byKey.set(key, warning)
  }

  const visible = Array.from(byKey.values()).sort((a, b) => warningWeight(b) - warningWeight(a))
  const suppressedCount =
    warnings.length
    - visible.length
    + duplicateCollapsedCount
    - duplicateCollapsedCount

  return {
    visible,
    suppressedCount: Math.max(0, warnings.length - visible.length),
    duplicateCollapsedCount,
    staleSuppressedCount,
    lowRiskSuppressedCount,
  }
}

export function warningFromQueueItem(item: {
  label: string
  kind: string
  priority: number
  scopeLabel?: string | null
}): SuppressibleWarning {
  const text = `${item.kind} ${item.label} ${item.scopeLabel ?? ''}`.toLowerCase()
  return {
    id: `${item.kind}:${item.label}`,
    dedupeKey: `${item.kind}:${item.label}:${item.scopeLabel ?? ''}`,
    severity: /block|sign|source|deviation|stabiliz/i.test(text) ? 'high' : 'medium',
    label: item.label,
    kind: item.kind,
    priority: item.priority,
    informationalOnly: /fyi|informational|can wait|follow-up later/i.test(text),
    acknowledged: false,
    escalated: /escalat|governance|safety/i.test(text),
  }
}
