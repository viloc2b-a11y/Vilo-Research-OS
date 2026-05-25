import { toCoordinatorSafeOperationalLanguage } from '@/lib/coordinator-calm/language'
import { MAX_WORK_QUEUE_ITEMS_SHOWN } from '@/lib/runtime-ui/guardrails'
import type { OperationalWorkQueueBucket } from '@/lib/coordinator-operations/types'
import {
  deriveCoordinatorProtectionQueue,
  type PreventionQueueInput,
} from '@/lib/site-defense/prevention-queue'

const COORDINATOR_SAFE_PREVENTION_LABELS: Record<string, string> = {
  resolve_before_sdv: 'Stabilize before SDV',
  signature_risk: 'Signoff pending',
  missing_source_continuity: 'Source continuity incomplete',
  high_deviation_risk: 'Chronology needs review',
  inspection_risk: 'Stabilization needed',
  monitor_likely_finding: 'Prevention focus',
  unresolved_escalation: 'Recovery recommended',
}

export function mapSiteDefensePreventionQueueToCoordinatorBucket(
  input: PreventionQueueInput,
): OperationalWorkQueueBucket {
  const queue = deriveCoordinatorProtectionQueue({
    ...input,
    maxCoordinatorItems: input.maxCoordinatorItems ?? MAX_WORK_QUEUE_ITEMS_SHOWN,
  })

  return {
    bucket: 'Finding prevention',
    items: queue.items.map((item) => ({
      ...item,
      label: toCoordinatorSafeOperationalLanguage(
        COORDINATOR_SAFE_PREVENTION_LABELS[item.kind] ?? item.label,
      ),
      scopeLabel: item.scopeLabel
        ? toCoordinatorSafeOperationalLanguage(item.scopeLabel)
        : item.scopeLabel,
    })),
  }
}
