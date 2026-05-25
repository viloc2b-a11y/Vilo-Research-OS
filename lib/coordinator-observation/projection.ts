import { deriveCoordinatorClaritySignals } from '@/lib/coordinator-observation/clarity-signals'
import { createLiveObservationSession } from '@/lib/coordinator-observation/session'
import type {
  LiveObservationSessionInput,
  ObservationProjection,
} from '@/lib/coordinator-observation/types'

export function deriveObservationProjection(
  input: LiveObservationSessionInput,
): ObservationProjection {
  const session = createLiveObservationSession(input)
  return {
    visibility: 'site_internal_only',
    session,
    claritySignals: deriveCoordinatorClaritySignals(session),
  }
}
