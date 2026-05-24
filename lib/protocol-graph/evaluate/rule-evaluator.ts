import type { RuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import type {
  GraphOrchestrationDirective,
  GraphVisitBlocker,
  ProtocolRuntimeRule,
  RuleAction,
  RuleCondition,
} from '@/lib/protocol-graph/types'

export function evaluateRuleCondition(
  condition: RuleCondition,
  ctx: RuntimeGraphContext,
): boolean {
  switch (condition.op) {
    case 'always':
      return true
    case 'has_open_ae':
      return ctx.openAeVisitCount > 0
    case 'has_open_ae_subject':
      return ctx.openAeSubjectCount > 0
    case 'lab_finding_critical':
      return ctx.unresolvedFindingCount > 0
    case 'lab_finding_for_procedure': {
      const code = condition.procedureCode?.toUpperCase()
      if (!code) return false
      return [...ctx.criticalLabProcedureCodes].some((c) => c.toUpperCase() === code)
    }
    case 'procedure_incomplete': {
      const code = condition.procedureCode
      if (!code) return false
      return ctx.incompleteProcedureCodes.has(code)
    }
    case 'procedure_unsigned': {
      const code = condition.procedureCode
      if (!code) return false
      return ctx.unsignedProcedureCodes.has(code)
    }
    case 'branch_active': {
      const key = condition.branchKey
      if (!key) return false
      return ctx.activeBranches.has(key)
    }
    case 'visit_outside_window':
      return ctx.windowStatus === 'outside_window'
    case 'visit_modality':
      return (ctx.visitModality ?? 'site') === (condition.modality ?? 'off_site')
    case 'prior_visit_incomplete':
      return false
    case 'repeated_procedure_due': {
      const code = condition.procedureCode
      if (!code) return false
      const min = condition.minRepeatCount ?? 1
      return ctx.completedProcedureCodes.has(code) && min >= 1
    }
    default:
      return false
  }
}

export function evaluateRuntimeRules(
  rules: ProtocolRuntimeRule[],
  ctx: RuntimeGraphContext,
  scopeFilter: 'visit' | 'subject' | 'study',
): { blockers: GraphVisitBlocker[]; directives: GraphOrchestrationDirective[] } {
  const blockers: GraphVisitBlocker[] = []
  const directives: GraphOrchestrationDirective[] = []

  for (const rule of rules) {
    if (rule.scope !== scopeFilter) continue
    const matched = evaluateRuleCondition(rule.when, ctx)
    for (const action of rule.then) {
      directives.push({ ruleId: rule.id, kind: rule.kind, action, matched })
      if (!matched) continue
      const blocker = actionToBlocker(rule.id, action)
      if (blocker) blockers.push(blocker)
    }
  }

  return { blockers, directives }
}

function actionToBlocker(ruleId: string, action: RuleAction): GraphVisitBlocker | null {
  switch (action.type) {
    case 'add_visit_blocker':
    case 'add_signoff_blocker':
    case 'block_visit_completion':
      return {
        id: `graph:${ruleId}:${action.type}`,
        category: 'protocol_graph',
        severity: action.severity ?? 'blocker',
        label: action.label,
        detail: action.detail ?? action.label,
        ruleId,
      }
    case 'trigger_safety_workflow':
    case 'escalate_monitoring':
      return {
        id: `graph:${ruleId}:${action.type}`,
        category: 'safety',
        severity: action.severity ?? 'warning',
        label: action.label,
        detail: action.detail ?? action.label,
        ruleId,
      }
    default:
      return null
  }
}
