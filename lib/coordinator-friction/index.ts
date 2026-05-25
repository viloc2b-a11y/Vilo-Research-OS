export type {
  CoordinatorFrictionEvent,
  CoordinatorFrictionEventType,
  CoordinatorFrictionObservation,
  CoordinatorFrictionProjection,
  CoordinatorFrictionSeverity,
  CoordinatorRecoverySignal,
  CoordinatorRecoverySignalName,
  QueueRefinementInput,
  QueueRefinementResult,
} from '@/lib/coordinator-friction/types'
export {
  deriveFrictionSeverity,
  severityWeight,
} from '@/lib/coordinator-friction/severity'
export {
  dedupeFrictionEvents,
  deriveCoordinatorFrictionEvents,
} from '@/lib/coordinator-friction/events'
export {
  dedupeRecoverySignals,
  deriveRecoverySignals,
} from '@/lib/coordinator-friction/recovery-signals'
export {
  preventionUxNoteFor,
  type PreventionUxNote,
} from '@/lib/coordinator-friction/ux-notes'
export { refineCoordinatorFrictionQueue } from '@/lib/coordinator-friction/queue-refinement'
export { deriveCoordinatorFrictionProjection } from '@/lib/coordinator-friction/projection'
