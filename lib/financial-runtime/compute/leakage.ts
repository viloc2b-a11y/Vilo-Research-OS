import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type {
  EarnedFinancialState,
  ExecutedFinancialState,
  ExpectedFinancialState,
  RevenueLeakageItem,
  UnscheduledRuntimeBurden,
} from '@/lib/financial-runtime/types'

export function detectRevenueLeakage(input: {
  ctx: VisitFinancialContext
  expected: ExpectedFinancialState
  executed: ExecutedFinancialState
  earned: EarnedFinancialState
  unscheduled: UnscheduledRuntimeBurden
  graphBlocked: boolean
}): RevenueLeakageItem[] {
  const items: RevenueLeakageItem[] = []
  const { ctx, expected, executed, earned, unscheduled, graphBlocked } = input

  for (const proc of ctx.procedures.filter((p) => !p.sectionDisabled)) {
    const isExecuted = proc.executionStatus === 'completed'
    const billable = proc.billableFlag || proc.billableDefault

    // Emit not_graph_compliant when the visit is blocked by the protocol graph
    // and the procedure was executed — earned units are non-compliant until graph clears.
    if (isExecuted && graphBlocked) {
      items.push({
        id: `leak:graph_compliant:${proc.id}`,
        kind: 'not_graph_compliant',
        severity: 'warning',
        label: 'Not graph compliant',
        detail: `${proc.label} executed while visit is blocked by protocol graph — earned units may not be graph-compliant.`,
        procedureExecutionId: proc.id,
        estimatedBillableUnits: billable ? 1 : 0,
      })
    }

    if (isExecuted && !proc.isSigned) {
      items.push({
        id: `leak:unsigned:${proc.id}`,
        kind: 'executed_unsigned',
        severity: billable ? 'critical' : 'warning',
        label: 'Executed but unsigned',
        detail: `${proc.label} completed without signature — revenue at risk.`,
        procedureExecutionId: proc.id,
        estimatedBillableUnits: billable ? 1 : 0,
      })
    }

    if (isExecuted && billable) {
      const submitted = ctx.sourceSubmittedByProcedure.get(proc.id)
      // Billable procedures require source capture; use billable as the binding signal
      // because VisitFinancialContext strips source_definition_version_id from DB rows.
      const hasBinding = billable
      if (hasBinding && !submitted) {
        items.push({
          id: `leak:source:${proc.id}`,
          kind: 'completed_missing_source',
          severity: 'critical',
          label: 'Missing source capture',
          detail: `${proc.label} completed but source not submitted.`,
          procedureExecutionId: proc.id,
          estimatedBillableUnits: 1,
        })
      }
    }
  }

  if (ctx.readiness && ctx.readiness.unresolvedFindingCount > 0) {
    items.push({
      id: 'leak:findings:visit',
      kind: 'completed_unresolved_findings',
      severity: 'critical',
      label: 'Unresolved findings',
      detail: `${ctx.readiness.unresolvedFindingCount} critical finding(s) block earnable state.`,
      estimatedBillableUnits: executed.procedureBillableCompletedCount,
    })
  }

  if (ctx.readiness?.blockers.some((b) => b.category === 'governance' && b.severity === 'blocker')) {
    items.push({
      id: 'leak:governance:visit',
      kind: 'blocked_governance',
      severity: 'warning',
      label: 'Governance blocker',
      detail: 'Open governance signals prevent earnable closeout.',
    })
  }

  if (ctx.openAeVisitCount > 0) {
    items.push({
      id: 'leak:safety:visit',
      kind: 'blocked_safety',
      severity: 'warning',
      label: 'Safety burden',
      detail: `${ctx.openAeVisitCount} open AE(s) on visit affect earnable execution.`,
    })
  }

  if (graphBlocked) {
    items.push({
      id: 'leak:graph:visit',
      kind: 'blocked_protocol_graph',
      severity: 'warning',
      label: 'Protocol graph blocker',
      detail: 'Graph orchestration blockers reduce graph-compliant earned units.',
    })
  }

  if (unscheduled.burdenScore > 0) {
    items.push({
      id: 'leak:unscheduled:visit',
      kind: 'unscheduled_burden',
      severity: 'info',
      label: 'Unscheduled runtime burden',
      detail: unscheduled.detail ?? 'Visit scheduling deviation increases coordinator cost.',
    })
  }

  const earnedIds = new Set(earned.units.filter((u) => u.earned).map((u) => u.procedureDefinitionId))
  const repeatCandidates = ctx.procedures.filter(
    (p) => p.executionStatus === 'completed' && !earnedIds.has(p.procedureDefinitionId),
  )
  if (repeatCandidates.length > 0 && expected.procedureCount > 0) {
    items.push({
      id: 'leak:repeat:visit',
      kind: 'repeat_procedure',
      severity: 'info',
      label: 'Repeat / non-earned procedures',
      detail: `${repeatCandidates.length} completed procedure(s) not in earned set.`,
    })
  }

  void executed
  return items
}

export function scoreLeakage(items: RevenueLeakageItem[]): number {
  return Math.min(
    100,
    items.reduce((sum, item) => {
      if (item.severity === 'critical') return sum + 15
      if (item.severity === 'warning') return sum + 8
      return sum + 3
    }, 0),
  )
}
