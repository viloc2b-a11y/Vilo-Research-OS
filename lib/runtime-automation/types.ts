/**
 * Phase 9 — Adaptive runtime automation (coordinator-supervised; not blind automation).
 */

export type AutomationTriggerKind =
  | 'unresolved_safety'
  | 'overdue_workflow'
  | 'visit_window_pressure'
  | 'governance_escalation'
  | 'financial_leakage'
  | 'replay_recurring_friction'
  | 'coordinator_overload'
  | 'repeated_reschedules'

export type AutomationActionKind =
  | 'create_orchestration_action'
  | 'escalate_urgency'
  | 'create_review_requirement'
  | 'strengthen_blocker_hint'
  | 'route_pi_review'
  | 'route_coordinator_follow_up'
  | 'route_operational_escalation'
  | 'materialize_workflow'

export type AutomationRule = {
  id: string
  label: string
  trigger: AutomationTriggerKind
  actionKinds: AutomationActionKind[]
  minPriority: number
  requiresExplicitApply: boolean
}

export type TriggeredAutomationRule = {
  ruleId: string
  trigger: AutomationTriggerKind
  severity: 'info' | 'warning' | 'critical'
  detail: string
}

export type ProposedAutomationAction = {
  id: string
  ruleId: string
  kind: AutomationActionKind
  label: string
  detail: string
  priority: number
  status: 'proposed' | 'applied' | 'reversed' | 'overridden'
  reversible: boolean
  requiresCoordinatorApproval: boolean
  visitId?: string | null
  orchestrationActionId?: string | null
  workflowDedupeKey?: string | null
}

export type AdaptedUrgency = {
  baseUrgencyScore: number
  adaptedUrgencyScore: number
  urgencyBoost: number
  adaptationReasons: string[]
}

export type OverloadAdaptation = {
  overloadDetected: boolean
  burdenScore: number
  throttleProposedActions: boolean
  maxActionsPerCycle: number
  adaptationNote: string | null
}

export type AutomationGovernanceSafeguard = {
  id: string
  severity: 'warning' | 'error'
  label: string
  detail: string
  blocksApply: boolean
}

export type RuntimeAutomationPlan = {
  planId: string
  triggeredRules: TriggeredAutomationRule[]
  proposedActions: ProposedAutomationAction[]
  adaptedUrgency: AdaptedUrgency
  overloadAdaptation: OverloadAdaptation
  safeguards: AutomationGovernanceSafeguard[]
  coordinatorSupervised: boolean
}

export type VisitRuntimeAutomation = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  automationVersion: number
  plan: RuntimeAutomationPlan
  pendingApplyCount: number
  appliedCount: number
  snapshot: Record<string, unknown>
}

export type SubjectRuntimeAutomation = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  automationVersion: number
  plan: RuntimeAutomationPlan
  pendingApplyCount: number
  snapshot: Record<string, unknown>
}

export type ApplyAutomationResult = {
  applied: number
  skipped: number
  executionIds: string[]
  errors: string[]
}
