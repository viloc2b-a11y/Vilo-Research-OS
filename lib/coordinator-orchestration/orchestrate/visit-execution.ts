import type { VisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import type { CoordinatorNextAction, VisitExecutionOrchestration } from '@/lib/coordinator-orchestration/types'

export function orchestrateVisitExecution(input: {
  ctx: VisitOrchestrationContext
  nextActions: CoordinatorNextAction[]
  graphBlocked: boolean
}): VisitExecutionOrchestration {
  const r = input.ctx.readiness
  const visitStatus = (r.snapshot.visitStatus as string | undefined) ?? ''

  let phase: VisitExecutionOrchestration['phase'] = 'in_visit'
  if (r.readinessStatus === 'terminal' || visitStatus === 'completed' || visitStatus === 'cancelled') {
    phase = 'terminal'
  } else if (r.pendingProcedureCount > 0 && visitStatus !== 'in_progress') {
    phase = 'pre_visit'
  } else if (
    r.pendingProcedureCount === 0
    && (r.unsignedProcedureCount > 0 || r.missingSourceCount > 0 || !r.visitCompletionReady)
  ) {
    phase = 'closeout'
  }

  const signoffBlocked =
    !r.coordinatorSignReady
    || r.unsignedProcedureCount > 0
    || r.missingSourceCount > 0
    || r.unresolvedFindingCount > 0

  const sequence: string[] = []
  if (r.pendingProcedureCount > 0) sequence.push('Execute pending procedures')
  if (r.missingSourceCount > 0) sequence.push('Submit source captures')
  if (r.unresolvedFindingCount > 0) sequence.push('Resolve validation findings')
  if (input.graphBlocked) sequence.push('Resolve protocol graph blockers')
  if (r.unsignedProcedureCount > 0) sequence.push('Complete procedure signatures')
  if (r.visitCompletionReady && !signoffBlocked) sequence.push('Coordinator / PI signoff')

  const top = input.nextActions[0]
  const primaryObjective =
    top?.label
    ?? (phase === 'closeout' ? 'Close visit with signable execution' : 'Advance visit execution')

  return {
    phase,
    primaryObjective,
    pendingProcedureCount: r.pendingProcedureCount,
    signoffBlocked,
    graphBlocked: input.graphBlocked,
    recommendedSequence: sequence,
  }
}
