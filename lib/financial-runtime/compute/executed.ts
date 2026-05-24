import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type { ExecutedFinancialState } from '@/lib/financial-runtime/types'

export function computeExecutedFinancialState(ctx: VisitFinancialContext): ExecutedFinancialState {
  const completed = ctx.procedures.filter(
    (p) => !p.sectionDisabled && p.executionStatus === 'completed',
  )

  const sourceSubmittedCount = [...ctx.sourceSubmittedByProcedure.values()].filter(Boolean).length

  return {
    procedureCompletedCount: completed.length,
    procedureBillableCompletedCount: completed.filter((p) => p.billableFlag || p.billableDefault).length,
    workflowExecutionCount: ctx.workflowOpenCount,
    sourceCaptureSubmittedCount: sourceSubmittedCount,
    safetyExecutionCount: ctx.openAeVisitCount,
    units: completed.map((p) => ({
      procedureExecutionId: p.id,
      procedureDefinitionId: p.procedureDefinitionId,
      procedureCode: p.code,
      procedureLabel: p.label,
      billable: p.billableFlag || p.billableDefault,
      isConditional: false,
      isRequired: true,
      executionStatus: p.executionStatus,
    })),
  }
}
