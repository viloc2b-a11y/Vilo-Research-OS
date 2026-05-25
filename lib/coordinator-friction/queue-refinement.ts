import { MAX_WORK_QUEUE_ITEMS_SHOWN } from '@/lib/runtime-ui/guardrails'
import type { OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'
import type {
  QueueRefinementInput,
  QueueRefinementResult,
} from '@/lib/coordinator-friction/types'

function refinementWeight(item: OperationalWorkQueueItem): number {
  const text = `${item.kind} ${item.label} ${item.scopeLabel ?? ''}`.toLowerCase()
  let weight = item.priority

  if (/sign|signature|signoff|pi|sub-i/.test(text)) weight += 45
  if (/source|continuity|capture|required field/.test(text)) weight += 30
  if (/block|unresolved|stalled|overdue/.test(text)) weight += 25
  if (/informational|fyi|can wait|later|note/.test(text)) weight -= 45

  return weight
}

function dedupeKey(item: OperationalWorkQueueItem): string {
  return `${item.kind}:${item.label}`.toLowerCase()
}

export function refineCoordinatorFrictionQueue(
  input: QueueRefinementInput,
): QueueRefinementResult {
  const maxVisibleItems = input.maxVisibleItems ?? MAX_WORK_QUEUE_ITEMS_SHOWN
  const byKey = new Map<string, OperationalWorkQueueItem>()
  let collapsedDuplicateCount = 0
  let suppressedNoiseCount = 0

  for (const item of input.items) {
    const key = dedupeKey(item)
    const existing = byKey.get(key)
    if (existing) {
      collapsedDuplicateCount += 1
      if (refinementWeight(item) > refinementWeight(existing)) {
        byKey.set(key, item)
      }
      continue
    }
    byKey.set(key, item)
  }

  const sorted = Array.from(byKey.values()).sort((a, b) => refinementWeight(b) - refinementWeight(a))
  const actionable = sorted.filter((item) => refinementWeight(item) >= 40)
  suppressedNoiseCount += sorted.length - actionable.length

  const visible = actionable.slice(0, maxVisibleItems)
  suppressedNoiseCount += Math.max(0, actionable.length - visible.length)

  return {
    items: visible,
    suppressedNoiseCount,
    collapsedDuplicateCount,
  }
}
