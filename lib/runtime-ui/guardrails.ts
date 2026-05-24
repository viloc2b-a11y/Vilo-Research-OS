/** Phase 10 UX guardrails — avoid coordinator overload in a single surface. */

export const MAX_BLOCKERS_SHOWN = 6
export const MAX_WORK_QUEUE_ITEMS_SHOWN = 5
export const MAX_AUTOMATION_PROPOSALS_SHOWN = 5
export const MAX_PRIMARY_CAUSES_SHOWN = 5

export function shouldShowLeakageWarning(input: {
  leakageScore: number
  actionableLeakage: boolean
}): boolean {
  if (!input.actionableLeakage) return false
  return input.leakageScore >= 20
}

export function compactModeEnabled(itemCount: number): boolean {
  return itemCount > 10
}
