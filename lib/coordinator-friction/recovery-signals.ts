import { severityWeight } from '@/lib/coordinator-friction/severity'
import type {
  CoordinatorFrictionEvent,
  CoordinatorRecoverySignal,
  CoordinatorRecoverySignalName,
} from '@/lib/coordinator-friction/types'

function signal(
  name: CoordinatorRecoverySignalName,
  event: CoordinatorFrictionEvent,
  reason: string,
): CoordinatorRecoverySignal {
  return {
    name,
    visibility: 'site_internal_only',
    nonPunitive: true,
    preventionOriented: true,
    severity: event.severity,
    reason,
  }
}

export function deriveRecoverySignals(
  events: CoordinatorFrictionEvent[],
): CoordinatorRecoverySignal[] {
  const signals: CoordinatorRecoverySignal[] = []

  for (const event of events) {
    if (
      event.type === 'abandoned_flow'
      || event.type === 'stalled_source_completion'
      || event.type === 'unresolved_blocker'
    ) {
      signals.push(signal('coordinator_stuck_risk', event, 'Coordinator may need a recovery path.'))
    }

    if (
      event.type === 'abandoned_flow'
      || event.type === 'excessive_click_path'
      || event.type === 'workflow_return_loop'
    ) {
      signals.push(signal('likely_workflow_abandonment', event, 'Workflow may not complete without simplification.'))
    }

    if (event.type === 'repeated_navigation' || event.type === 'excessive_click_path') {
      signals.push(signal('excessive_navigation_pattern', event, 'Coordinator is navigating too much to complete work.'))
    }

    if (event.type === 'repeated_submission_failure' || event.type === 'unresolved_blocker') {
      signals.push(signal('repeated_failed_resolution', event, 'Resolution attempts are not reaching completion.'))
    }

    if (
      event.type === 'confusion_reopen_pattern'
      || event.type === 'repeated_open_without_completion'
      || event.type === 'workflow_return_loop'
    ) {
      signals.push(signal('likely_operational_confusion', event, 'Workflow state may not be clear enough.'))
    }
  }

  return dedupeRecoverySignals(signals)
}

export function dedupeRecoverySignals(signals: CoordinatorRecoverySignal[]): CoordinatorRecoverySignal[] {
  const byName = new Map<CoordinatorRecoverySignalName, CoordinatorRecoverySignal>()
  for (const item of signals) {
    const existing = byName.get(item.name)
    if (!existing || severityWeight(item.severity) > severityWeight(existing.severity)) {
      byName.set(item.name, item)
    }
  }
  return Array.from(byName.values()).sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
}
