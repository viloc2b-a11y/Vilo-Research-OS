import type { SafetySignalItem } from '@/lib/subject/safety-signals/types'
import type {
  AdverseEventLifecycleStatus,
  AdverseEventSourceKind,
  SubjectAdverseEventTimelineItem,
} from '@/lib/subject/adverse-events/types'

function mapKind(kind: SafetySignalItem['kind']): AdverseEventSourceKind {
  return kind
}

function deriveLifecycle(item: SafetySignalItem): AdverseEventLifecycleStatus {
  if (!item.isUnresolved) {
    const closed =
      item.status === 'resolved' ||
      item.status === 'closed' ||
      item.status === 'verified' ||
      item.status === 'QUERY_RESOLVED'
    return closed ? 'resolved' : 'closed'
  }
  if (item.missingFollowUp || item.actionNeeded) return 'follow_up'
  return 'open'
}

function parseSeriousness(item: SafetySignalItem): boolean {
  if (item.severity === 'error' || item.severity === 'high') return true
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase()
  return /\bsae\b|serious adverse|life[- ]?threatening/.test(text)
}

function parseSeverity(item: SafetySignalItem): string | null {
  if (item.severity === 'unknown') return null
  return item.severity
}

export function mapSafetySignalToTimelineItem(
  item: SafetySignalItem,
): SubjectAdverseEventTimelineItem {
  const lifecycleStatus = deriveLifecycle(item)
  const seriousness = parseSeriousness(item)

  return {
    id: item.id,
    sourceKind: mapKind(item.kind),
    eventTerm: item.title,
    preferredTerm: null,
    severity: parseSeverity(item),
    seriousness,
    relationship: null,
    relationshipCode: null,
    lifecycleStatus,
    onsetDate: item.occurredAt.slice(0, 10),
    resolutionDate: lifecycleStatus === 'resolved' || lifecycleStatus === 'closed'
      ? item.occurredAt.slice(0, 10)
      : null,
    visitId: item.visitId,
    visitLabel: item.visitName,
    sourceAttribution: item.sourceLabel,
    lastUpdatedAt: item.occurredAt,
    reporter: null,
    isSeriousAdverseEvent: seriousness,
    href: item.href,
    captureHref: item.captureHref,
    reviewHref: item.reviewHref,
    registryId: null,
    isEditable: false,
    registryComments: null,
  }
}
