import type { ProcedureRuntimeInstanceRow } from './visit-runtime-types'

type ProcedureProgressInput = Pick<ProcedureRuntimeInstanceRow, 'procedureStatus' | 'required'>

const TERMINAL_PROCEDURE_STATUSES = new Set(['completed', 'skipped', 'not_applicable'])

export function recalculateVisitProgress(procedures: ProcedureProgressInput[]): number {
  if (procedures.length === 0) return 0
  const terminalCount = procedures.filter((procedure) =>
    TERMINAL_PROCEDURE_STATUSES.has(procedure.procedureStatus),
  ).length
  return Math.round((terminalCount / procedures.length) * 100)
}

export function canCompleteVisit(procedures: ProcedureProgressInput[]): boolean {
  const requiredProcedures = procedures.filter((procedure) => procedure.required)
  if (requiredProcedures.length === 0) return true
  return requiredProcedures.every((procedure) =>
    TERMINAL_PROCEDURE_STATUSES.has(procedure.procedureStatus),
  )
}

export function getIncompleteRequiredProcedures(
  procedures: ProcedureProgressInput[],
): ProcedureProgressInput[] {
  return procedures.filter(
    (procedure) => procedure.required && !TERMINAL_PROCEDURE_STATUSES.has(procedure.procedureStatus),
  )
}
