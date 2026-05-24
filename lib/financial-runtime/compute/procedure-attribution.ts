import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type {
  EarnedFinancialState,
  ExpectedFinancialState,
  ProcedureFinancialAttribution,
  RevenueLeakageItem,
} from '@/lib/financial-runtime/types'

export function buildProcedureFinancialAttributions(input: {
  ctx: VisitFinancialContext
  expected: ExpectedFinancialState
  earned: EarnedFinancialState
  leakage: RevenueLeakageItem[]
}): ProcedureFinancialAttribution[] {
  const expectedByDef = new Map(
    input.expected.units.map((u) => [u.procedureDefinitionId, u]),
  )
  const earnedByDef = new Map(
    input.earned.units.map((u) => [u.procedureDefinitionId, u]),
  )

  const leakageByPe = new Map<string, RevenueLeakageItem['kind'][]>()
  for (const item of input.leakage) {
    if (!item.procedureExecutionId) continue
    const list = leakageByPe.get(item.procedureExecutionId) ?? []
    list.push(item.kind)
    leakageByPe.set(item.procedureExecutionId, list)
  }

  const attributions: ProcedureFinancialAttribution[] = []

  for (const proc of input.ctx.procedures) {
    if (proc.sectionDisabled) continue
    const exp = expectedByDef.has(proc.procedureDefinitionId)
    const executed = proc.executionStatus === 'completed'
    const earnedUnit = earnedByDef.get(proc.procedureDefinitionId)
    const billable = proc.billableFlag || proc.billableDefault

    attributions.push({
      procedureExecutionId: proc.id,
      procedureDefinitionId: proc.procedureDefinitionId,
      procedureCode: proc.code,
      expected: exp,
      executed,
      earned: Boolean(earnedUnit?.earned),
      billable,
      leakageKinds: leakageByPe.get(proc.id) ?? [],
      earnBlockers: earnedUnit?.earnBlockers ?? [],
    })
  }

  return attributions
}
