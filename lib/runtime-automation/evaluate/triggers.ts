import type { VisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { RUNTIME_AUTOMATION_RULES_V1 } from '@/lib/runtime-automation/rules/registry'
import type { TriggeredAutomationRule } from '@/lib/runtime-automation/types'

export function evaluateAutomationTriggers(ctx: VisitAutomationContext): TriggeredAutomationRule[] {
  const triggered: TriggeredAutomationRule[] = []
  const r = ctx.readiness
  const o = ctx.orchestration

  if (r.safetyBlockerCount > 0 || r.blockers.some((b) => b.category.includes('safety'))) {
    triggered.push({
      ruleId: 'rule:safety:unresolved',
      trigger: 'unresolved_safety',
      severity: r.safetyBlockerCount > 1 ? 'critical' : 'warning',
      detail: `${r.safetyBlockerCount} safety blocker(s) require coordinator supervision.`,
    })
  }

  if (ctx.overdueWorkflowCount > 0) {
    triggered.push({
      ruleId: 'rule:workflow:overdue',
      trigger: 'overdue_workflow',
      severity: 'warning',
      detail: `${ctx.overdueWorkflowCount} overdue workflow item(s).`,
    })
  }

  const scheduledDate = (r.snapshot.scheduledDate as string | undefined) ?? null
  const visitStatus = (r.snapshot.visitStatus as string | undefined) ?? ''
  if (
    scheduledDate
    && Date.parse(scheduledDate) < Date.now()
    && !['completed', 'cancelled', 'terminal'].includes(visitStatus)
  ) {
    triggered.push({
      ruleId: 'rule:visit:window-pressure',
      trigger: 'visit_window_pressure',
      severity: 'warning',
      detail: 'Visit is past scheduled window — timeline pressure elevated.',
    })
  }
  if (o.urgency.slaPressure) {
    triggered.push({
      ruleId: 'rule:visit:window-pressure',
      trigger: 'visit_window_pressure',
      severity: 'critical',
      detail: 'SLA pressure from orchestration urgency model.',
    })
  }

  if (o.workQueue.escalation.length > 0 || r.blockers.some((b) => b.category === 'governance')) {
    triggered.push({
      ruleId: 'rule:governance:escalation',
      trigger: 'governance_escalation',
      severity: 'warning',
      detail: 'Governance or operational escalation signals active.',
    })
  }

  if (
    (o.financialLeakageEscalation.leakageScore ?? 0) > 0
    || o.financialLeakageEscalation.criticalLeakageCount > 0
  ) {
    triggered.push({
      ruleId: 'rule:financial:leakage',
      trigger: 'financial_leakage',
      severity: o.financialLeakageEscalation.criticalLeakageCount > 0 ? 'critical' : 'warning',
      detail: o.financialLeakageEscalation.recommendedActions[0] ?? 'Financial leakage detected.',
    })
  }

  if (ctx.replayFrictionDetected) {
    triggered.push({
      ruleId: 'rule:replay:friction',
      trigger: 'replay_recurring_friction',
      severity: 'info',
      detail: 'Replay or friction signals suggest recurring operational blockers.',
    })
  }

  const burden = (r.snapshot.operationalIntelligence as { burdenScore?: number })?.burdenScore ?? 0
  if (burden >= 65 || o.priorityScores.coordinatorBurden >= 70) {
    triggered.push({
      ruleId: 'rule:coordinator:overload',
      trigger: 'coordinator_overload',
      severity: burden >= 80 ? 'critical' : 'warning',
      detail: `Coordinator burden elevated (score ${burden}).`,
    })
  }

  if (ctx.rescheduleCount >= 2) {
    triggered.push({
      ruleId: 'rule:visit:reschedule-repeat',
      trigger: 'repeated_reschedules',
      severity: 'warning',
      detail: `Visit rescheduled ${ctx.rescheduleCount} time(s).`,
    })
  }

  return triggered.filter((t) => {
    const rule = RUNTIME_AUTOMATION_RULES_V1.find((r) => r.id === t.ruleId)
    return Boolean(rule)
  }).filter((t, i, arr) => arr.findIndex((x) => x.ruleId === t.ruleId) === i)
}
