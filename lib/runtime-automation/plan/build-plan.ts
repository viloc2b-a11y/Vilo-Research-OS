import { adaptOperationalOverload } from '@/lib/runtime-automation/adapt/overload-adaptation'
import { adaptRuntimeUrgency } from '@/lib/runtime-automation/adapt/urgency-adaptation'
import type { VisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { deriveProposedAutomationActions } from '@/lib/runtime-automation/evaluate/derive-actions'
import { evaluateAutomationTriggers } from '@/lib/runtime-automation/evaluate/triggers'
import {
  applyBlockedBySafeguards,
  evaluateAutomationGovernanceSafeguards,
} from '@/lib/runtime-automation/safeguards/governance'
import type { RuntimeAutomationPlan } from '@/lib/runtime-automation/types'

export function buildVisitRuntimeAutomationPlan(ctx: VisitAutomationContext): RuntimeAutomationPlan {
  const triggered = evaluateAutomationTriggers(ctx)
  const rawProposed = deriveProposedAutomationActions({
    ctx,
    triggered,
    orchestrationActions: ctx.orchestration.nextActions,
  })
  const adaptedUrgency = adaptRuntimeUrgency({
    orchestration: ctx.orchestration,
    triggered,
  })
  const { adaptation: overloadAdaptation, throttled } = adaptOperationalOverload({
    orchestration: ctx.orchestration,
    proposedActions: rawProposed,
  })

  const safeguards = evaluateAutomationGovernanceSafeguards({
    proposedActions: throttled,
  })

  if (applyBlockedBySafeguards(safeguards)) {
    return {
      planId: `plan:${ctx.visitId}:${Date.now()}`,
      triggeredRules: triggered,
      proposedActions: [],
      adaptedUrgency,
      overloadAdaptation,
      safeguards,
      coordinatorSupervised: true,
    }
  }

  return {
    planId: `plan:${ctx.visitId}:${new Date().toISOString()}`,
    triggeredRules: triggered,
    proposedActions: throttled,
    adaptedUrgency,
    overloadAdaptation,
    safeguards,
    coordinatorSupervised: true,
  }
}
