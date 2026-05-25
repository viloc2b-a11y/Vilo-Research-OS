/**
 * Queue simplification — collapse urgency, cap visible actions, calm language.
 */

import type {
  OperationalNextActionItem,
  OperationalWorkQueueBucket,
  OperationalWorkQueueItem,
} from '@/lib/coordinator-operations/types'
import { refineCoordinatorFrictionQueue } from '@/lib/coordinator-friction'
import { toCoordinatorSafeOperationalLanguage } from '@/lib/coordinator-calm/language'
import {
  suppressWarnings,
  warningFromQueueItem,
  type SuppressibleWarning,
} from '@/lib/coordinator-calm/warning-suppression'

export const MAX_CRITICAL_CALM_ACTIONS = 5
export const MAX_SECONDARY_CALM_ACTIONS = 3

export type CalmQueueSimplificationResult = {
  buckets: OperationalWorkQueueBucket[]
  criticalActions: OperationalWorkQueueItem[]
  secondaryActions: OperationalWorkQueueItem[]
  suppressedNoiseCount: number
  collapsedDuplicateCount: number
}

function calmItem(item: OperationalWorkQueueItem): OperationalWorkQueueItem {
  return {
    ...item,
    label: toCoordinatorSafeOperationalLanguage(item.label),
    scopeLabel: item.scopeLabel
      ? toCoordinatorSafeOperationalLanguage(item.scopeLabel)
      : item.scopeLabel,
  }
}

function warningsFromBuckets(buckets: OperationalWorkQueueBucket[]): SuppressibleWarning[] {
  return buckets.flatMap((bucket) =>
    bucket.items.map((item) => warningFromQueueItem({ ...item, kind: `${bucket.bucket}:${item.kind}` })),
  )
}

function itemsFromWarnings(warnings: SuppressibleWarning[]): OperationalWorkQueueItem[] {
  return warnings.map((w) => ({
    label: toCoordinatorSafeOperationalLanguage(w.label),
    kind: w.kind,
    priority: w.priority,
    scopeLabel: null,
  }))
}

export function simplifyOperationalQueues(
  buckets: OperationalWorkQueueBucket[],
  options?: {
    maxCritical?: number
    maxSecondary?: number
  },
): CalmQueueSimplificationResult {
  const maxCritical = options?.maxCritical ?? MAX_CRITICAL_CALM_ACTIONS
  const maxSecondary = options?.maxSecondary ?? MAX_SECONDARY_CALM_ACTIONS

  const calmBuckets = buckets.map((bucket) => ({
    ...bucket,
    items: bucket.items.map(calmItem),
  }))

  const suppression = suppressWarnings(warningsFromBuckets(calmBuckets))
  const friction = refineCoordinatorFrictionQueue({
    items: itemsFromWarnings(suppression.visible),
    maxVisibleItems: maxCritical + maxSecondary,
  })

  const criticalActions = friction.items.slice(0, maxCritical).map(calmItem)
  const secondaryActions = friction.items.slice(maxCritical, maxCritical + maxSecondary).map(calmItem)

  const simplifiedBuckets = calmBuckets
    .map((bucket) => ({
      ...bucket,
      items: bucket.items
        .map(calmItem)
        .filter((item) =>
          criticalActions.some((c) => c.label === item.label && c.kind === item.kind)
          || secondaryActions.some((s) => s.label === item.label && s.kind === item.kind),
        )
        .slice(0, maxCritical),
    }))
    .filter((b) => b.items.length > 0)

  return {
    buckets: simplifiedBuckets.length > 0 ? simplifiedBuckets : calmBuckets.map((b) => ({
      ...b,
      items: b.items.slice(0, maxCritical),
    })).filter((b) => b.items.length > 0),
    criticalActions,
    secondaryActions,
    suppressedNoiseCount:
      suppression.suppressedCount
      + friction.suppressedNoiseCount
      + Math.max(0, friction.items.length - maxCritical - maxSecondary),
    collapsedDuplicateCount:
      suppression.duplicateCollapsedCount + friction.collapsedDuplicateCount,
  }
}

export function calmNextActions(
  actions: OperationalNextActionItem[],
  maxVisible = MAX_CRITICAL_CALM_ACTIONS,
): OperationalNextActionItem[] {
  return actions
    .map((action) => ({
      ...action,
      label: toCoordinatorSafeOperationalLanguage(action.label),
      detail: action.detail ? toCoordinatorSafeOperationalLanguage(action.detail) : action.detail,
      scopeLabel: toCoordinatorSafeOperationalLanguage(action.scopeLabel),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxVisible)
}
