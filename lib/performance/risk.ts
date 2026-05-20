import type {
  SubjectRiskQueueItem,
  SubjectRiskReasonKind,
  SubjectRiskSeverity,
} from '@/app/(ops)/performance/_lib/performance-types'

/** Severity tier by reason kind (Phase 4 coordinator ordering). */
export function severityForReasonKind(kind: SubjectRiskReasonKind): SubjectRiskSeverity {
  switch (kind) {
    case 'missed_visit':
    case 'blocked_procedure':
      return 'critical'
    case 'out_of_window':
    case 'overdue_action':
      return 'attention'
    case 'window_warning':
      return 'warning'
  }
}

const SEVERITY_RANK: Record<SubjectRiskSeverity, number> = {
  critical: 0,
  attention: 1,
  warning: 2,
}

/** Sort: severity tier, then oldest urgency date first. */
export function compareRiskQueueItems(a: SubjectRiskQueueItem, b: SubjectRiskQueueItem): number {
  const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (severityDelta !== 0) return severityDelta
  return a.sortDate.localeCompare(b.sortDate)
}

export function sortAndCapRiskQueue(items: SubjectRiskQueueItem[], limit: number): SubjectRiskQueueItem[] {
  return [...items].sort(compareRiskQueueItems).slice(0, limit)
}

export function hasCriticalRisks(items: SubjectRiskQueueItem[]): boolean {
  return items.some(
    (item) => item.operationalState === 'critical' || item.severity === 'critical',
  )
}

export function performanceScopeDescription(selectedStudyName: string | null): string {
  if (selectedStudyName) {
    return `Metrics and risks for ${selectedStudyName}.`
  }
  return 'Metrics and risks across all studies in your organization.'
}
