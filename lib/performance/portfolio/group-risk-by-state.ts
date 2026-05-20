import type { OperationalState } from '@/lib/performance/scoring/types'
import { STATE_PRIORITY_RANK } from '@/lib/performance/scoring/types'
import type { SubjectRiskQueueItem } from '@/app/(ops)/performance/_lib/performance-types'

const STATE_ORDER: OperationalState[] = ['critical', 'risk', 'watch']

export type RiskStateGroup = {
  state: OperationalState
  items: SubjectRiskQueueItem[]
}

function itemOperationalState(item: SubjectRiskQueueItem): OperationalState {
  if (item.operationalState) return item.operationalState
  switch (item.severity) {
    case 'critical':
      return 'critical'
    case 'attention':
      return 'risk'
    default:
      return 'watch'
  }
}

export function groupRiskQueueByOperationalState(
  items: SubjectRiskQueueItem[],
): RiskStateGroup[] {
  const buckets = new Map<OperationalState, SubjectRiskQueueItem[]>()

  for (const item of items) {
    const state = itemOperationalState(item)
    if (state === 'healthy') continue
    const list = buckets.get(state) ?? []
    list.push(item)
    buckets.set(state, list)
  }

  return STATE_ORDER.filter((state) => buckets.has(state)).map((state) => ({
    state,
    items: buckets.get(state) ?? [],
  }))
}

export function compareRiskGroups(a: RiskStateGroup, b: RiskStateGroup): number {
  return STATE_PRIORITY_RANK[b.state] - STATE_PRIORITY_RANK[a.state]
}
