import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type { ExpectedFinancialState } from '@/lib/financial-runtime/types'

export function computeExpectedFinancialState(
  ctx: VisitFinancialContext,
  graphRevision: number | null,
): ExpectedFinancialState {
  const instantiatedIds = new Set(ctx.procedures.map((p) => p.procedureDefinitionId))
  const units = []

  for (const map of ctx.protocolMaps) {
    const proc = ctx.procedures.find((p) => p.procedureDefinitionId === map.procedureDefinitionId)
    const isExpected =
      map.isRequired && !map.isConditional
      || map.isConditional && instantiatedIds.has(map.procedureDefinitionId)

    if (!isExpected) continue

    units.push({
      procedureExecutionId: proc?.id ?? null,
      procedureDefinitionId: map.procedureDefinitionId,
      procedureCode: proc?.code ?? 'unknown',
      procedureLabel: proc?.label ?? 'Procedure',
      billable: proc ? proc.billableFlag || proc.billableDefault : false,
      isConditional: map.isConditional,
      isRequired: map.isRequired,
    })
  }

  return {
    procedureCount: units.length,
    billableProcedureCount: units.filter((u) => u.billable).length,
    requiredProcedureCount: units.filter((u) => u.isRequired && !u.isConditional).length,
    conditionalExpectedCount: units.filter((u) => u.isConditional).length,
    units,
    protocolGraphRevision: graphRevision,
  }
}
