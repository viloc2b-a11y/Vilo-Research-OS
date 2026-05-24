import type { ProjectionBlockerSeverity, RuntimeProjectionBlocker } from '@/lib/projections/types'

export function projectionBlocker(input: {
  id: string
  category: string
  severity?: ProjectionBlockerSeverity
  label: string
  detail: string
  href?: string | null
}): RuntimeProjectionBlocker {
  return {
    id: input.id,
    category: input.category,
    severity: input.severity ?? 'blocker',
    label: input.label,
    detail: input.detail,
    href: input.href ?? null,
  }
}

export function countBlockersBySeverity(
  blockers: RuntimeProjectionBlocker[],
  severity: ProjectionBlockerSeverity,
): number {
  return blockers.filter((b) => b.severity === severity).length
}

export function deriveReadinessStatusFromBlockers(
  blockers: RuntimeProjectionBlocker[],
  terminal: boolean,
): 'ready' | 'attention' | 'blocked' | 'terminal' {
  if (terminal) return 'terminal'
  if (blockers.some((b) => b.severity === 'blocker')) return 'blocked'
  if (blockers.some((b) => b.severity === 'warning')) return 'attention'
  return 'ready'
}

export function deriveOperationalHealthFromSignals(input: {
  criticalReasons: string[]
  attentionReasons: string[]
}): 'healthy' | 'attention' | 'critical' {
  if (input.criticalReasons.length > 0) return 'critical'
  if (input.attentionReasons.length > 0) return 'attention'
  return 'healthy'
}

export function deriveStudyRiskLevel(input: {
  criticalSubjectCount: number
  attentionSubjectCount: number
  openQueryCount: number
  missedVisitCount: number
}): 'low' | 'moderate' | 'elevated' | 'critical' {
  if (input.criticalSubjectCount > 0 || input.openQueryCount >= 10) return 'critical'
  if (input.missedVisitCount >= 5 || input.attentionSubjectCount >= 3) return 'elevated'
  if (input.attentionSubjectCount > 0 || input.openQueryCount > 0) return 'moderate'
  return 'low'
}

export function burdenScore(count: number, weight = 1): number {
  return Math.min(100, Math.round(count * weight))
}
