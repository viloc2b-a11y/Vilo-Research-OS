import { createServerClient } from '@/lib/supabase/server'
import { determineStudyStartReadiness, type ReadyToStartDecision } from './ready-to-start-decision'

/**
 * Check if a study can be activated based on the Ready To Start decision.
 * Activation gate rules:
 *   READY_TO_START  → allow activation
 *   ALMOST_READY    → allow activation with warning
 *   NOT_READY       → block activation
 */
export type ActivationGateResult = {
  allowed: boolean
  requiresWarning: boolean
  decision: ReadyToStartDecision
}

export async function checkActivationGate(
  studyId: string,
): Promise<ActivationGateResult> {
  const decision = await determineStudyStartReadiness(studyId)

  const allowed = decision.status !== 'NOT_READY'
  const requiresWarning = decision.status === 'ALMOST_READY'

  return { allowed, requiresWarning, decision }
}
