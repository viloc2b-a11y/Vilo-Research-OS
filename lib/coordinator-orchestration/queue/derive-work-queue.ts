import type {
  CoordinatorNextAction,
  DerivedWorkQueue,
  WorkQueueItem,
} from '@/lib/coordinator-orchestration/types'
import type { RuntimeUrgency } from '@/lib/coordinator-orchestration/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

function toItem(action: CoordinatorNextAction, bucket: WorkQueueItem['bucket']): WorkQueueItem {
  return {
    actionId: action.id,
    bucket,
    kind: action.kind,
    label: action.label,
    priority: action.priority,
  }
}

export function deriveWorkQueue(input: {
  nextActions: CoordinatorNextAction[]
  urgency: RuntimeUrgency
  readiness: VisitReadinessProjection
}): DerivedWorkQueue {
  const actionNow: WorkQueueItem[] = []
  const canWait: WorkQueueItem[] = []
  const blocked: WorkQueueItem[] = []
  const escalation: WorkQueueItem[] = []
  const piReview: WorkQueueItem[] = []
  const coordinatorFollowUp: WorkQueueItem[] = []

  const isBlocked = input.readiness.readinessStatus === 'blocked'

  for (const action of input.nextActions) {
    if (action.requiresPiReview) {
      piReview.push(toItem(action, 'pi_review'))
      continue
    }
    if (action.requiresEscalation) {
      escalation.push(toItem(action, 'escalation'))
      continue
    }
    if (isBlocked && action.priority < 70 && action.domain !== 'financial') {
      blocked.push(toItem(action, 'blocked'))
      continue
    }
    if (action.priority >= 75 || input.urgency.level === 'critical' || input.urgency.level === 'high') {
      actionNow.push(toItem(action, 'action_now'))
      continue
    }
    if (action.kind === 'coordinator_follow_up' || action.kind === 'coordinator_workflow') {
      coordinatorFollowUp.push(toItem(action, 'coordinator_follow_up'))
      continue
    }
    if (action.priority >= 45) {
      canWait.push(toItem(action, 'can_wait'))
    } else {
      coordinatorFollowUp.push(toItem(action, 'coordinator_follow_up'))
    }
  }

  return {
    actionNow: actionNow.slice(0, 15),
    canWait: canWait.slice(0, 10),
    blocked: blocked.slice(0, 10),
    escalation: escalation.slice(0, 8),
    piReview: piReview.slice(0, 8),
    coordinatorFollowUp: coordinatorFollowUp.slice(0, 12),
  }
}
