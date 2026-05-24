import type { AutomationRule } from '@/lib/runtime-automation/types'

/**
 * v1 runtime automation rules — derived triggers only; apply requires coordinator path.
 */
export const RUNTIME_AUTOMATION_RULES_V1: AutomationRule[] = [
  {
    id: 'rule:safety:unresolved',
    label: 'Unresolved safety escalation',
    trigger: 'unresolved_safety',
    actionKinds: ['route_pi_review', 'escalate_urgency', 'materialize_workflow', 'create_review_requirement'],
    minPriority: 70,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:workflow:overdue',
    label: 'Overdue workflow follow-up',
    trigger: 'overdue_workflow',
    actionKinds: ['materialize_workflow', 'route_coordinator_follow_up'],
    minPriority: 65,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:visit:window-pressure',
    label: 'Visit window pressure',
    trigger: 'visit_window_pressure',
    actionKinds: ['escalate_urgency', 'route_coordinator_follow_up'],
    minPriority: 60,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:governance:escalation',
    label: 'Governance escalation',
    trigger: 'governance_escalation',
    actionKinds: ['strengthen_blocker_hint', 'create_review_requirement', 'route_pi_review'],
    minPriority: 72,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:financial:leakage',
    label: 'Financial leakage remediation',
    trigger: 'financial_leakage',
    actionKinds: ['route_coordinator_follow_up', 'materialize_workflow', 'create_orchestration_action'],
    minPriority: 68,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:replay:friction',
    label: 'Replay recurring friction',
    trigger: 'replay_recurring_friction',
    actionKinds: ['route_coordinator_follow_up', 'create_orchestration_action'],
    minPriority: 50,
    requiresExplicitApply: true,
  },
  {
    id: 'rule:coordinator:overload',
    label: 'Coordinator overload adaptation',
    trigger: 'coordinator_overload',
    actionKinds: ['escalate_urgency'],
    minPriority: 55,
    requiresExplicitApply: false,
  },
  {
    id: 'rule:visit:reschedule-repeat',
    label: 'Repeated reschedule escalation',
    trigger: 'repeated_reschedules',
    actionKinds: ['route_operational_escalation', 'materialize_workflow'],
    minPriority: 70,
    requiresExplicitApply: true,
  },
]

export function getAutomationRule(ruleId: string): AutomationRule | undefined {
  return RUNTIME_AUTOMATION_RULES_V1.find((r) => r.id === ruleId)
}
