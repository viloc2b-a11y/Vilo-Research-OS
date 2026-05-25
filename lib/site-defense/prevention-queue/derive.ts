import { COORDINATOR_PROTECTION_RULES } from '@/lib/site-defense/coordinator-protection'
import { deriveSiteDefenseSignals } from '@/lib/site-defense/signals'
import type { SiteDefenseSignal } from '@/lib/site-defense/signals'
import type {
  CoordinatorProtectionQueue,
  PreventionQueueBucket,
  PreventionQueueBucketName,
  PreventionQueueInput,
  PreventionQueueItem,
} from '@/lib/site-defense/prevention-queue/types'

const bucketRank: Record<PreventionQueueBucketName, number> = {
  resolve_before_sdv: 100,
  inspection_risk: 92,
  signature_risk: 88,
  high_deviation_risk: 84,
  missing_source_continuity: 80,
  monitor_likely_finding: 78,
  unresolved_escalation: 72,
}

function count(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function item(input: PreventionQueueItem): PreventionQueueItem {
  return input
}

function fromSignals(signals: SiteDefenseSignal[]): PreventionQueueItem[] {
  const items: PreventionQueueItem[] = []

  for (const signal of signals) {
    if (signal.name === 'likely_signature_finding') {
      items.push(item({
        id: `site-defense:signature:${signal.source}`,
        bucket: 'signature_risk',
        signal: signal.name,
        label: 'Signoff pending',
        nextAction: 'Complete or request required signoff',
        priority: signal.riskWeight,
        actionKey: 'complete-signoff',
        source: signal.source,
      }))
    }

    if (signal.name === 'likely_source_finding' || signal.name === 'likely_source_gap') {
      items.push(item({
        id: `site-defense:source:${signal.source}`,
        bucket: 'missing_source_continuity',
        signal: signal.name,
        label: 'Missing source continuity',
        nextAction: 'Complete required source before review',
        priority: signal.riskWeight,
        actionKey: 'complete-source',
        source: signal.source,
      }))
    }

    if (signal.name === 'likely_deviation' || signal.name === 'likely_temporal_deviation') {
      items.push(item({
        id: `site-defense:temporal:${signal.source}`,
        bucket: 'high_deviation_risk',
        signal: signal.name,
        label: 'Chronology needs review',
        nextAction: 'Review chronology and resolve timing gap',
        priority: signal.riskWeight,
        actionKey: 'review-chronology',
        source: signal.source,
      }))
    }

    if (signal.name === 'likely_workflow_escalation') {
      items.push(item({
        id: `site-defense:escalation:${signal.source}`,
        bucket: 'unresolved_escalation',
        signal: signal.name,
        label: 'Recovery recommended',
        nextAction: 'Resume or resolve stale workflow',
        priority: signal.riskWeight,
        actionKey: 'recover-workflow',
        source: signal.source,
      }))
    }

    if (signal.name === 'likely_sdv_mismatch') {
      items.push(item({
        id: `site-defense:sdv:${signal.source}`,
        bucket: 'inspection_risk',
        signal: signal.name,
        label: 'Stabilization needed',
        nextAction: 'Stabilize evidence before SDV',
        priority: signal.riskWeight,
        actionKey: 'stabilize-evidence',
        source: signal.source,
      }))
    }

    if (signal.name === 'likely_monitor_query') {
      items.push(item({
        id: `site-defense:monitor-finding:${signal.source}`,
        bucket: 'monitor_likely_finding',
        signal: signal.name,
        label: 'Prevention focus',
        nextAction: 'Resolve before monitor review',
        priority: signal.riskWeight,
        actionKey: 'prevent-monitor-finding',
        source: signal.source,
      }))
    }
  }

  return items
}

function addDirectRiskItems(input: PreventionQueueInput, items: PreventionQueueItem[]): PreventionQueueItem[] {
  const direct = [...items]

  if (count(input.sourceIntegrityMismatchCount) > 0) {
    direct.push(item({
      id: 'site-defense:inspection:source-integrity',
      bucket: 'inspection_risk',
      signal: 'likely_sdv_mismatch',
      label: 'Stabilization needed',
      nextAction: 'Stabilize source and procedure evidence',
      priority: 96,
      actionKey: 'stabilize-evidence',
      source: 'source_integrity_mismatch',
    }))
  }

  if (count(input.unresolvedGovernanceBlockerCount) > 0) {
    direct.push(item({
      id: 'site-defense:escalation:governance',
      bucket: 'unresolved_escalation',
      signal: 'likely_workflow_escalation',
      label: 'Recovery recommended',
      nextAction: 'Resolve governance blocker before review',
      priority: 86,
      actionKey: 'resolve-governance',
      source: 'unresolved_governance_blockers',
    }))
  }

  if (
    count(input.sourceIntegrityMismatchCount) > 0
    || count(input.temporalConsistencyIssueCount) > 0
  ) {
    direct.push(item({
      id: 'site-defense:pre-sdv:composite',
      bucket: 'resolve_before_sdv',
      signal: 'likely_sdv_mismatch',
      label: 'Resolve before SDV',
      nextAction: 'Stabilize evidence before SDV or external release',
      priority: 98,
      actionKey: 'resolve-before-sdv',
      source: 'pre_sdv_stabilization',
    }))
  }

  return direct
}

export function derivePreventionQueue(input: PreventionQueueInput): PreventionQueueBucket[] {
  const signals = input.signals ?? deriveSiteDefenseSignals(input)
  const rawItems = addDirectRiskItems(input, fromSignals(signals))
  const deduped = dedupePreventionItems(rawItems)
  const byBucket = new Map<PreventionQueueBucketName, PreventionQueueItem[]>()

  for (const queueItem of deduped) {
    const bucket = byBucket.get(queueItem.bucket) ?? []
    bucket.push(queueItem)
    byBucket.set(queueItem.bucket, bucket)
  }

  return Array.from(byBucket.entries())
    .map(([bucket, items]) => ({
      bucket,
      items: items.sort(comparePreventionItems),
    }))
    .sort((a, b) => bucketRank[b.bucket] - bucketRank[a.bucket])
}

export function flattenPreventionQueue(buckets: PreventionQueueBucket[]): PreventionQueueItem[] {
  return buckets.flatMap((bucket) => bucket.items).sort(comparePreventionItems)
}

export function dedupePreventionItems(items: PreventionQueueItem[]): PreventionQueueItem[] {
  const byAction = new Map<string, PreventionQueueItem>()
  for (const queueItem of items) {
    const key = `${queueItem.bucket}:${queueItem.actionKey}`
    const existing = byAction.get(key)
    if (!existing || comparePreventionItems(queueItem, existing) < 0) {
      byAction.set(key, queueItem)
    }
  }
  return Array.from(byAction.values()).sort(comparePreventionItems)
}

export function comparePreventionItems(a: PreventionQueueItem, b: PreventionQueueItem): number {
  const bucketDelta = bucketRank[b.bucket] - bucketRank[a.bucket]
  return bucketDelta || b.priority - a.priority
}

export function deriveCoordinatorProtectionQueue(input: PreventionQueueInput): CoordinatorProtectionQueue {
  const maxItems =
    input.maxCoordinatorItems ?? COORDINATOR_PROTECTION_RULES.maxVisibleActions
  const allItems = flattenPreventionQueue(derivePreventionQueue(input))
  const visible = allItems.slice(0, maxItems).map((queueItem) => ({
    label: queueItem.nextAction,
    kind: queueItem.bucket,
    priority: queueItem.priority,
    scopeLabel: queueItem.label,
  }))

  return {
    items: visible,
    hiddenNoiseCount: Math.max(0, allItems.length - visible.length),
  }
}
