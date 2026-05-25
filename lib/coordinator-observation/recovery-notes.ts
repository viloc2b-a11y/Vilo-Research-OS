import type { WorkflowRecoveryObservation } from '@/lib/coordinator-observation/types'

export type RecoveryUxNote = {
  whatShouldHappenNext: string
  howToRecover: string
  whatBlocksCompletion: string
  whatCanSafelyWait: string
  whatRisksEscalation: string
}

export function buildRecoveryUxNote(
  observation: WorkflowRecoveryObservation,
): RecoveryUxNote {
  return {
    whatShouldHappenNext: observation.recoveryWorked
      ? 'Keep the coordinator in the recovered workflow step.'
      : 'Return the coordinator to the exact unresolved action.',
    howToRecover: observation.recoveredAt
      ? 'Resume from the last successful recovery point.'
      : 'Show a continue where left off action.',
    whatBlocksCompletion: observation.requiredHumanExplanation
      ? 'The workflow needs clearer in-product explanation.'
      : 'The unresolved step is not obvious enough yet.',
    whatCanSafelyWait: 'Background context and informational notes can stay collapsed.',
    whatRisksEscalation: 'Unresolved blockers, signoff delays, and source continuity gaps should stay visible.',
  }
}
