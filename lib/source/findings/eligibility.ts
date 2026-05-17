/**
 * Phase 5.5A — UI-only finding action eligibility (RPC remains authority).
 */

export type FindingActionEligibility = {
  canAcknowledge: boolean
  canResolve: boolean
  canWaive: boolean
}

export function findingActionEligibility(statusLabel: string): FindingActionEligibility {
  const status = statusLabel.trim().toLowerCase()
  return {
    canAcknowledge: status === 'open',
    canResolve: status === 'open' || status === 'acknowledged',
    canWaive: status === 'open' || status === 'acknowledged',
  }
}
