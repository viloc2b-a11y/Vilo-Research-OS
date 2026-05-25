import { deriveFrictionSeverity } from '@/lib/coordinator-friction/severity'
import type {
  CoordinatorFrictionEvent,
  CoordinatorFrictionEventType,
  CoordinatorFrictionObservation,
} from '@/lib/coordinator-friction/types'
import { preventionUxNoteFor } from '@/lib/coordinator-friction/ux-notes'

function event(
  observation: CoordinatorFrictionObservation,
  type: CoordinatorFrictionEventType,
): CoordinatorFrictionEvent {
  const note = preventionUxNoteFor(type)
  return {
    id: `${observation.workflowId}:${type}`,
    type,
    visibility: 'site_internal_only',
    workflowId: observation.workflowId,
    workflowLabel: observation.workflowLabel,
    severity: deriveFrictionSeverity(observation),
    ...note,
  }
}

export function deriveCoordinatorFrictionEvents(
  observations: CoordinatorFrictionObservation[],
): CoordinatorFrictionEvent[] {
  const events: CoordinatorFrictionEvent[] = []

  for (const observation of observations) {
    if ((observation.navigationRepeats ?? 0) >= 3) {
      events.push(event(observation, 'repeated_navigation'))
    }
    if (observation.abandonedFlow) {
      events.push(event(observation, 'abandoned_flow'))
    }
    if ((observation.unresolvedBlockerCount ?? 0) > 0) {
      events.push(event(observation, 'unresolved_blocker'))
    }
    if ((observation.submissionFailureCount ?? 0) >= 2) {
      events.push(event(observation, 'repeated_submission_failure'))
    }
    if ((observation.clickPathLength ?? 0) >= 10) {
      events.push(event(observation, 'excessive_click_path'))
    }
    if ((observation.openWithoutCompletionCount ?? 0) >= 2) {
      events.push(event(observation, 'repeated_open_without_completion'))
    }
    if ((observation.stalledSourceMinutes ?? 0) >= 30) {
      events.push(event(observation, 'stalled_source_completion'))
    }
    if ((observation.workflowReturnCount ?? 0) >= 3) {
      events.push(event(observation, 'workflow_return_loop'))
    }
    if ((observation.signatureDelayHours ?? 0) >= 24) {
      events.push(event(observation, 'unresolved_signature_delay'))
    }
    if ((observation.confusionReopenCount ?? 0) >= 2) {
      events.push(event(observation, 'confusion_reopen_pattern'))
    }
  }

  return dedupeFrictionEvents(events)
}

export function dedupeFrictionEvents(events: CoordinatorFrictionEvent[]): CoordinatorFrictionEvent[] {
  const byKey = new Map<string, CoordinatorFrictionEvent>()
  for (const item of events) {
    const key = `${item.workflowId}:${item.type}`
    if (!byKey.has(key)) byKey.set(key, item)
  }
  return Array.from(byKey.values())
}
