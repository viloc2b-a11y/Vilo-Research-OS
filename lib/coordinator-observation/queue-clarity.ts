import { MAX_WORK_QUEUE_ITEMS_SHOWN } from '@/lib/runtime-ui/guardrails'
import type { OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'
import type {
  ObservationQueueRefinementInput,
  ObservationQueueRefinementResult,
} from '@/lib/coordinator-observation/types'

function queueWeight(item: OperationalWorkQueueItem): number {
  const text = `${item.kind} ${item.label} ${item.scopeLabel ?? ''}`.toLowerCase()
  let weight = item.priority

  if (/block|unresolved|overdue|stalled/.test(text)) weight += 35
  if (/sign|signature|signoff|pi|sub-i/.test(text)) weight += 45
  if (/source|continuity|required field|capture/.test(text)) weight += 35
  if (/informational|fyi|note|low value|can wait|later/.test(text)) weight -= 60
  if (/warning/.test(text)) weight -= 10

  return weight
}

function duplicateUrgencyKey(item: OperationalWorkQueueItem): string {
  return `${item.kind}:${item.label}`.toLowerCase()
}

export function refineObservationQueueClarity(
  input: ObservationQueueRefinementInput,
): ObservationQueueRefinementResult {
  const maxVisibleItems = input.maxVisibleItems ?? MAX_WORK_QUEUE_ITEMS_SHOWN
  const deduped = new Map<string, OperationalWorkQueueItem>()
  let collapsedDuplicateUrgencyCount = 0
  let suppressedLowValueCount = 0

  for (const item of input.items) {
    const key = duplicateUrgencyKey(item)
    const existing = deduped.get(key)
    if (existing) {
      collapsedDuplicateUrgencyCount += 1
      if (queueWeight(item) > queueWeight(existing)) deduped.set(key, item)
      continue
    }
    deduped.set(key, item)
  }

  const sorted = Array.from(deduped.values()).sort((a, b) => queueWeight(b) - queueWeight(a))
  const actionable = sorted.filter((item) => queueWeight(item) >= 40)
  suppressedLowValueCount += sorted.length - actionable.length

  const items = actionable.slice(0, maxVisibleItems)
  suppressedLowValueCount += Math.max(0, actionable.length - items.length)

  return {
    items,
    suppressedLowValueCount,
    collapsedDuplicateUrgencyCount,
  }
}
