import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type { ExpectedFinancialState, EarnedFinancialState } from '@/lib/financial-runtime/types'

export function computeEarnedFinancialState(input: {
  ctx: VisitFinancialContext
  expected: ExpectedFinancialState
  visitBlocked: boolean
  graphBlocked: boolean
}): EarnedFinancialState {
  const { ctx, expected, visitBlocked, graphBlocked } = input
  const expectedIds = new Set(expected.units.map((u) => u.procedureDefinitionId))

  const units = ctx.procedures
    .filter((p) => !p.sectionDisabled && expectedIds.has(p.procedureDefinitionId))
    .map((p) => {
      const earnBlockers: string[] = []
      const billable = p.billableFlag || p.billableDefault

      if (p.executionStatus !== 'completed') {
        earnBlockers.push('not_completed')
      }
      if (!p.isSigned) {
        earnBlockers.push('unsigned')
      }
      if (!billable) {
        earnBlockers.push('not_billable')
      }
      if (visitBlocked) {
        earnBlockers.push('visit_blocked')
      }
      if (graphBlocked) {
        earnBlockers.push('graph_blocked')
      }
      if (ctx.readiness && ctx.readiness.unresolvedFindingCount > 0) {
        earnBlockers.push('unresolved_findings')
      }
      if (ctx.readiness && ctx.readiness.missingSourceCount > 0) {
        const hasSource = ctx.sourceSubmittedByProcedure.get(p.id)
        if (!hasSource) earnBlockers.push('missing_source')
      }
      if (ctx.openAeVisitCount > 0) {
        earnBlockers.push('safety_open')
      }

      const earned =
        earnBlockers.length === 0
        && p.executionStatus === 'completed'
        && p.isSigned
        && billable

      return {
        procedureExecutionId: p.id,
        procedureDefinitionId: p.procedureDefinitionId,
        procedureCode: p.code,
        procedureLabel: p.label,
        billable,
        isConditional: false,
        isRequired: true,
        earned,
        earnBlockers,
      }
    })

  return {
    procedureEarnedCount: units.filter((u) => u.earned).length,
    billableEarnedCount: units.filter((u) => u.earned && u.billable).length,
    graphCompliantEarnedCount: units.filter((u) => u.earned && !graphBlocked).length,
    signableEarnedCount: units.filter((u) => u.earned && u.earnBlockers.length === 0).length,
    units,
  }
}
