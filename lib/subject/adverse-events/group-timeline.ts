import type {
  AdverseEventLifecycleStatus,
  AdverseEventTimelineSection,
  AdverseEventTimelineSummary,
  SubjectAdverseEventTimelineItem,
} from '@/lib/subject/adverse-events/types'

const RECENT_DAYS = 14

const LIFECYCLE_RANK: Record<AdverseEventLifecycleStatus, number> = {
  open: 0,
  follow_up: 1,
  resolved: 2,
  closed: 3,
}

function parseOnsetMs(item: SubjectAdverseEventTimelineItem): number {
  const raw = item.onsetDate ?? item.lastUpdatedAt
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function sortAdverseEventTimeline(
  items: SubjectAdverseEventTimelineItem[],
): SubjectAdverseEventTimelineItem[] {
  return [...items].sort((a, b) => {
    const rankA = LIFECYCLE_RANK[a.lifecycleStatus]
    const rankB = LIFECYCLE_RANK[b.lifecycleStatus]
    if (rankA !== rankB) return rankA - rankB
    return parseOnsetMs(b) - parseOnsetMs(a)
  })
}

export function summarizeAdverseEventTimeline(
  items: SubjectAdverseEventTimelineItem[],
  refDate = new Date(),
): AdverseEventTimelineSummary {
  let openAe = 0
  let sae = 0
  let followUpPending = 0
  let recentlyUpdated = 0
  let resolved = 0

  for (const item of items) {
    if (item.lifecycleStatus === 'open') openAe += 1
    if (item.lifecycleStatus === 'follow_up') followUpPending += 1
    if (item.lifecycleStatus === 'resolved' || item.lifecycleStatus === 'closed') {
      resolved += 1
    }
    if (item.isSeriousAdverseEvent && item.lifecycleStatus !== 'closed') sae += 1

    const updatedMs = new Date(item.lastUpdatedAt).getTime()
    if (!Number.isNaN(updatedMs)) {
      const days = (refDate.getTime() - updatedMs) / (1000 * 60 * 60 * 24)
      if (days <= RECENT_DAYS) recentlyUpdated += 1
    }
  }

  return { openAe, sae, followUpPending, recentlyUpdated, resolved }
}

export function groupAdverseEventTimeline(
  items: SubjectAdverseEventTimelineItem[],
): AdverseEventTimelineSection[] {
  const active: SubjectAdverseEventTimelineItem[] = []
  const followUp: SubjectAdverseEventTimelineItem[] = []
  const resolved: SubjectAdverseEventTimelineItem[] = []

  for (const item of items) {
    if (item.lifecycleStatus === 'open') active.push(item)
    else if (item.lifecycleStatus === 'follow_up') followUp.push(item)
    else resolved.push(item)
  }

  const sortSection = (rows: SubjectAdverseEventTimelineItem[]) =>
    [...rows].sort((a, b) => parseOnsetMs(b) - parseOnsetMs(a))

  return [
    {
      key: 'active',
      title: 'Active / Open',
      description: 'New or ongoing AE-related capture and operational items.',
      items: sortSection(active),
    },
    {
      key: 'follow_up',
      title: 'Follow-up required',
      description: 'Submitted or flagged items needing coordinator or investigator follow-up.',
      items: sortSection(followUp),
    },
    {
      key: 'resolved',
      title: 'Resolved / Closed',
      description: 'Closed queries, resolved findings, and completed AE documentation.',
      items: sortSection(resolved),
    },
  ]
}
