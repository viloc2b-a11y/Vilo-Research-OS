/**
 * Visit workspace progress strip — steps backed by operational data only.
 */

export type VisitProgressStep = {
  id: string
  label: string
  done: boolean
}

export function buildVisitProgressSteps(input: {
  visitStatus: string
  totalProcs: number
  completedProcs: number
  proceduresWithSourceCount: number
  submittedSourceForSourceProcsCount: number
  coordinatorSigned: boolean
  investigatorSigned: boolean
  isLocked: boolean
}): VisitProgressStep[] {
  const checkedIn = ['checked_in', 'in_progress', 'completed', 'locked'].includes(
    input.visitStatus,
  )
  const proceduresDone =
    input.totalProcs > 0 && input.completedProcs === input.totalProcs
  const sourceDone =
    input.proceduresWithSourceCount === 0
      ? proceduresDone
      : input.submittedSourceForSourceProcsCount >= input.proceduresWithSourceCount

  return [
    { id: 'check-in', label: 'Check-in', done: checkedIn },
    { id: 'procedures', label: 'Procedures', done: proceduresDone },
    { id: 'source', label: 'Source complete', done: sourceDone },
    { id: 'coordinator', label: 'Coordinator sign', done: input.coordinatorSigned },
    { id: 'investigator', label: 'Investigator sign', done: input.investigatorSigned },
    { id: 'locked', label: 'Locked', done: input.isLocked },
  ]
}

export function currentVisitProgressIndex(steps: VisitProgressStep[]): number {
  const firstOpen = steps.findIndex((step) => !step.done)
  return firstOpen === -1 ? steps.length - 1 : firstOpen
}
