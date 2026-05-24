import {
  DEFAULT_MAX_ACTIONS,
  OVERLOAD_MAX_ACTIONS,
} from '@/lib/runtime-automation/constants'
import type { OverloadAdaptation, ProposedAutomationAction } from '@/lib/runtime-automation/types'
import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'

export function adaptOperationalOverload(input: {
  orchestration: VisitCoordinatorOrchestration
  proposedActions: ProposedAutomationAction[]
}): { adaptation: OverloadAdaptation; throttled: ProposedAutomationAction[] } {
  const burden =
    input.orchestration.priorityScores.coordinatorBurden
    ?? (input.orchestration.snapshot as { burdenScore?: number }).burdenScore
    ?? 0

  const overloadDetected =
    burden >= 70
    || input.orchestration.workQueue.actionNow.length >= 8

  const maxActions = overloadDetected ? OVERLOAD_MAX_ACTIONS : DEFAULT_MAX_ACTIONS

  const sorted = [...input.proposedActions].sort((a, b) => b.priority - a.priority)
  const throttled = sorted.slice(0, maxActions)

  return {
    adaptation: {
      overloadDetected,
      burdenScore: typeof burden === 'number' ? burden : 0,
      throttleProposedActions: overloadDetected && sorted.length > maxActions,
      maxActionsPerCycle: maxActions,
      adaptationNote: overloadDetected
        ? `Throttled to ${maxActions} highest-priority proposed actions — coordinator remains supervisory.`
        : null,
    },
    throttled,
  }
}
