/**
 * Coordinator confidence signals — stabilization clarity without scoring/surveillance.
 */

export type CoordinatorConfidenceInput = {
  runtimeId: string
  unsignedProcedureCount?: number
  incompleteSourceCount?: number
  unresolvedBlockerCount?: number
  sourceIntegrityMismatchCount?: number
  staleWorkflowCount?: number
  stabilizationComplete?: boolean
  siteReviewed?: boolean
  externalReviewReady?: boolean
}

export type CoordinatorConfidenceSignal = {
  visibility: 'site_internal_only'
  runtimeId: string
  /** Plain-language coordinator guidance (non-punitive). */
  message: string
  category:
    | 'stabilized'
    | 'safe_to_defer'
    | 'blocks_completion'
    | 'blocks_external_readiness'
    | 'immediate_action'
}

function count(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

export function deriveCoordinatorConfidenceSignals(
  input: CoordinatorConfidenceInput,
): CoordinatorConfidenceSignal[] {
  const signals: CoordinatorConfidenceSignal[] = []
  const base = { visibility: 'site_internal_only' as const, runtimeId: input.runtimeId }

  const hasBlockers =
    count(input.unresolvedBlockerCount) > 0
    || count(input.sourceIntegrityMismatchCount) > 0
  const hasSignoff = count(input.unsignedProcedureCount) > 0
  const hasSource = count(input.incompleteSourceCount) > 0
  const hasStale = count(input.staleWorkflowCount) > 0

  if (input.externalReviewReady && input.stabilizationComplete) {
    signals.push({
      ...base,
      category: 'stabilized',
      message: 'Evidence is stabilized for external review when the site releases it.',
    })
  } else if (!hasBlockers && !hasSignoff && !hasSource && !hasStale) {
    signals.push({
      ...base,
      category: 'stabilized',
      message: 'This workflow is in a steady state — no immediate prevention actions.',
    })
  }

  if (hasStale && !hasBlockers && !hasSignoff) {
    signals.push({
      ...base,
      category: 'safe_to_defer',
      message: 'Stale flow noted — safe to defer until your next visit block if no visits are due today.',
    })
  }

  if (hasBlockers) {
    signals.push({
      ...base,
      category: 'blocks_completion',
      message: 'Unresolved blocker is holding completion — resolve before signoff or release.',
    })
  }

  if (hasSignoff) {
    signals.push({
      ...base,
      category: 'immediate_action',
      message: 'Signoff pending — this is the fastest path to stabilization.',
    })
  }

  if (hasSource) {
    signals.push({
      ...base,
      category: 'blocks_completion',
      message: 'Source continuity incomplete — finish required fields to unblock progression.',
    })
  }

  if (hasBlockers || hasSignoff || hasSource || count(input.sourceIntegrityMismatchCount) > 0) {
    signals.push({
      ...base,
      category: 'blocks_external_readiness',
      message: 'External review readiness is on hold until site stabilization completes.',
    })
  }

  return signals
}

/** Ensures no surveillance/scoring fields are present on outward payloads. */
export function assertNoSurveillanceMetrics(payload: unknown): boolean {
  const text = JSON.stringify(payload).toLowerCase()
  const forbidden = [
    'productivity',
    'coordinator_score',
    'ranking',
    'surveillance',
    'performance_rating',
    'burden_score',
    'overload_index',
  ]
  return !forbidden.some((term) => text.includes(term))
}
