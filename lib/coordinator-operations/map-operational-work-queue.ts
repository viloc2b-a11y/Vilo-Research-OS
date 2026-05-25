/**
 * Map orchestration work_queue JSON + readiness hints to Phase 16B coordinator buckets.
 */

import { toCoordinatorSafeOperationalLanguage } from '@/lib/coordinator-calm/language'
import { OPERATIONAL_WORK_QUEUE_BUCKET } from '@/lib/coordinator-operations/constants'
import type { OperationalWorkQueueBucket, OperationalWorkQueueItem } from '@/lib/coordinator-operations/types'
import { MAX_WORK_QUEUE_ITEMS_SHOWN } from '@/lib/runtime-ui/guardrails'

function calmQueueItem(item: OperationalWorkQueueItem): OperationalWorkQueueItem {
  return {
    ...item,
    label: toCoordinatorSafeOperationalLanguage(item.label),
  }
}

type RawWorkQueue = {
  actionNow?: OperationalWorkQueueItem[]
  blocked?: OperationalWorkQueueItem[]
  piReview?: OperationalWorkQueueItem[]
  escalation?: OperationalWorkQueueItem[]
  coordinatorFollowUp?: OperationalWorkQueueItem[]
  canWait?: OperationalWorkQueueItem[]
}

function sliceItems(items: OperationalWorkQueueItem[] | undefined): OperationalWorkQueueItem[] {
  return (items ?? []).slice(0, MAX_WORK_QUEUE_ITEMS_SHOWN)
}

function mergeItems(
  ...groups: OperationalWorkQueueItem[][]
): OperationalWorkQueueItem[] {
  const seen = new Set<string>()
  const out: OperationalWorkQueueItem[] = []
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.kind}:${item.label}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
      if (out.length >= MAX_WORK_QUEUE_ITEMS_SHOWN) break
    }
    if (out.length >= MAX_WORK_QUEUE_ITEMS_SHOWN) break
  }
  return out
}

function sourceIncompleteItems(input: {
  missingSourceCount?: number
  unsignedProcedureCount?: number
  raw?: RawWorkQueue
}): OperationalWorkQueueItem[] {
  const fromQueue = [...(input.raw?.actionNow ?? []), ...(input.raw?.blocked ?? [])].filter(
    (item) =>
      /source|capture|submit|finding|validation/i.test(`${item.kind} ${item.label}`),
  )
  const synthetic: OperationalWorkQueueItem[] = []
  if ((input.missingSourceCount ?? 0) > 0) {
    synthetic.push({
      label: 'Complete missing source capture',
      kind: 'source_capture',
      priority: 80,
    })
  }
  if ((input.unsignedProcedureCount ?? 0) > 0) {
    synthetic.push({
      label: 'Resolve unsigned procedures',
      kind: 'signature',
      priority: 75,
    })
  }
  return mergeItems(fromQueue, synthetic).map(calmQueueItem)
}

function safetyGovernanceItems(input: {
  safetyBlockerCount?: number
  raw?: RawWorkQueue
}): OperationalWorkQueueItem[] {
  const fromQueue = mergeItems(
    sliceItems(input.raw?.escalation),
    (input.raw?.blocked ?? []).filter((item) =>
      /safety|governance|ae|adverse|deviation|query/i.test(`${item.kind} ${item.label}`),
    ),
  )
  const synthetic: OperationalWorkQueueItem[] = []
  if ((input.safetyBlockerCount ?? 0) > 0) {
    synthetic.push({
      label: 'Review safety or governance blockers',
      kind: 'safety_governance',
      priority: 85,
    })
  }
  return mergeItems(fromQueue, synthetic).map(calmQueueItem)
}

/**
 * Derive Phase 16B buckets from persisted orchestration work_queue + projection counts.
 */
export function mapOperationalWorkQueue(input: {
  workQueue: RawWorkQueue | null | undefined
  missingSourceCount?: number
  unsignedProcedureCount?: number
  safetyBlockerCount?: number
}): OperationalWorkQueueBucket[] {
  const raw = input.workQueue ?? {}

  const buckets: OperationalWorkQueueBucket[] = [
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.DO_NOW,
      items: sliceItems(raw.actionNow).map(calmQueueItem),
    },
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.BLOCKED,
      items: sliceItems(raw.blocked).map(calmQueueItem),
    },
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.NEEDS_PI,
      items: sliceItems(raw.piReview).map(calmQueueItem),
    },
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.SOURCE_INCOMPLETE,
      items: sourceIncompleteItems({
        missingSourceCount: input.missingSourceCount,
        unsignedProcedureCount: input.unsignedProcedureCount,
        raw,
      }),
    },
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.SAFETY_GOVERNANCE,
      items: safetyGovernanceItems({
        safetyBlockerCount: input.safetyBlockerCount,
        raw,
      }),
    },
    {
      bucket: OPERATIONAL_WORK_QUEUE_BUCKET.FOLLOW_UP_LATER,
      items: mergeItems(sliceItems(raw.canWait), sliceItems(raw.coordinatorFollowUp)).map(calmQueueItem),
    },
  ]

  return buckets.filter((b) => b.items.length > 0)
}

/** Visit runtime UI bucket labels (same semantics as operational surface). */
export function mapVisitRuntimeWorkQueueBuckets(
  orch: { work_queue?: RawWorkQueue } | null,
  readiness?: {
    missingSourceCount?: number
    unsignedProcedureCount?: number
    safetyBlockerCount?: number
  },
): Array<{ bucket: string; items: Array<{ label: string; kind: string; priority: number }> }> {
  return mapOperationalWorkQueue({
    workQueue: orch?.work_queue,
    missingSourceCount: readiness?.missingSourceCount,
    unsignedProcedureCount: readiness?.unsignedProcedureCount,
    safetyBlockerCount: readiness?.safetyBlockerCount,
  })
}
