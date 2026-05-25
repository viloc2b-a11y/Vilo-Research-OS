import { deriveCoordinatorFrictionEvents } from '@/lib/coordinator-friction/events'
import { deriveRecoverySignals } from '@/lib/coordinator-friction/recovery-signals'
import type {
  CoordinatorFrictionObservation,
  CoordinatorFrictionProjection,
} from '@/lib/coordinator-friction/types'

export function deriveCoordinatorFrictionProjection(
  observations: CoordinatorFrictionObservation[],
): CoordinatorFrictionProjection {
  const events = deriveCoordinatorFrictionEvents(observations)
  return {
    visibility: 'site_internal_only',
    events,
    recoverySignals: deriveRecoverySignals(events),
  }
}
