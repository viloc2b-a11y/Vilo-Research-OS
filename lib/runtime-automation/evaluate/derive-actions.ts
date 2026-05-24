import { getAutomationRule } from '@/lib/runtime-automation/rules/registry'
import type { VisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import type {
  ProposedAutomationAction,
  TriggeredAutomationRule,
} from '@/lib/runtime-automation/types'
import type { CoordinatorNextAction } from '@/lib/coordinator-orchestration/types'

function priorityFromSeverity(severity: TriggeredAutomationRule['severity']): number {
  if (severity === 'critical') return 90
  if (severity === 'warning') return 70
  return 50
}

function workflowDedupeKey(ruleId: string, visitId: string, kind: string): string {
  return `auto:${ruleId}:${visitId}:${kind}`
}

export function deriveProposedAutomationActions(input: {
  ctx: VisitAutomationContext
  triggered: TriggeredAutomationRule[]
  orchestrationActions: CoordinatorNextAction[]
}): ProposedAutomationAction[] {
  const proposed: ProposedAutomationAction[] = []
  const seen = new Set<string>()

  for (const trigger of input.triggered) {
    const rule = getAutomationRule(trigger.ruleId)
    if (!rule) continue

    const basePriority = Math.max(rule.minPriority, priorityFromSeverity(trigger.severity))

    for (const kind of rule.actionKinds) {
      const id = `auto:${trigger.ruleId}:${kind}`
      if (seen.has(id)) continue
      seen.add(id)

      const orchestrationMatch = input.orchestrationActions.find((a) => {
        if (kind === 'route_pi_review') return a.requiresPiReview
        if (kind === 'route_coordinator_follow_up') {
          return a.kind === 'coordinator_follow_up' || a.kind === 'coordinator_workflow'
        }
        if (kind === 'route_operational_escalation') return a.requiresEscalation
        if (kind === 'create_orchestration_action') return true
        return false
      })

      proposed.push({
        id,
        ruleId: trigger.ruleId,
        kind,
        label: `${rule.label} — ${kind.replace(/_/g, ' ')}`,
        detail: trigger.detail,
        priority: basePriority + (orchestrationMatch ? 5 : 0),
        status: 'proposed',
        reversible: kind !== 'escalate_urgency' && kind !== 'strengthen_blocker_hint',
        requiresCoordinatorApproval: rule.requiresExplicitApply,
        visitId: input.ctx.visitId,
        orchestrationActionId: orchestrationMatch?.id ?? null,
        workflowDedupeKey:
          kind === 'materialize_workflow'
            ? workflowDedupeKey(trigger.ruleId, input.ctx.visitId, kind)
            : null,
      })
    }
  }

  return proposed.sort((a, b) => b.priority - a.priority)
}
