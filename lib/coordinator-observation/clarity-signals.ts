import type {
  CoordinatorClaritySignal,
  CoordinatorClaritySignalName,
  LiveObservationSession,
} from '@/lib/coordinator-observation/types'

function signal(name: CoordinatorClaritySignalName, reason: string): CoordinatorClaritySignal {
  return {
    name,
    visibility: 'site_internal_only',
    nonPunitive: true,
    refinementOnly: true,
    reason,
  }
}

export function deriveCoordinatorClaritySignals(
  session: LiveObservationSession,
): CoordinatorClaritySignal[] {
  const signals: CoordinatorClaritySignal[] = []
  const recovery = session.recovery_observation
  const confusionText = session.unresolved_confusion_points.join(' ').toLowerCase()
  const feedbackText = session.coordinator_feedback_notes.join(' ').toLowerCase()

  if (
    confusionText.includes('next')
    || feedbackText.includes('what do i do')
    || session.friction_events_observed.some((event) => event.type === 'abandoned_flow')
  ) {
    signals.push(signal('unclear_next_action', 'The next action was not clear enough to keep the workflow moving.'))
  }

  if (recovery.requiredHumanExplanation || feedbackText.includes('help')) {
    signals.push(signal('repeated_help_needed', 'The workflow required human explanation instead of self-guided recovery.'))
  }

  if (
    (recovery.repeatedNavigationAwayCount ?? 0) >= 2
    || session.friction_events_observed.some((event) => event.type === 'repeated_navigation')
  ) {
    signals.push(signal('unresolved_navigation_confusion', 'The coordinator navigated away repeatedly while trying to recover.'))
  }

  if (
    confusionText.includes('blocker')
    || session.friction_events_observed.some((event) => event.type === 'unresolved_blocker')
  ) {
    signals.push(signal('blocker_not_understood', 'The blocker was visible but not clear enough to resolve confidently.'))
  }

  if (
    confusionText.includes('term')
    || confusionText.includes('word')
    || feedbackText.includes('label')
  ) {
    signals.push(signal('terminology_confusion', 'Coordinator-facing language needs simplification.'))
  }

  if (
    (recovery.sourceReopenCount ?? 0) >= 2
    || session.friction_events_observed.some((event) => event.type === 'confusion_reopen_pattern')
  ) {
    signals.push(signal('repeated_reopen_pattern', 'The same source or workflow was reopened multiple times without resolution.'))
  }

  return dedupeClaritySignals(signals)
}

export function dedupeClaritySignals(signals: CoordinatorClaritySignal[]): CoordinatorClaritySignal[] {
  const byName = new Map<CoordinatorClaritySignalName, CoordinatorClaritySignal>()
  for (const item of signals) {
    if (!byName.has(item.name)) byName.set(item.name, item)
  }
  return Array.from(byName.values())
}
