import type { VisitOperationalIntelligence } from '@/lib/operational-intelligence/types'
import type { VisitFinancialRuntime } from '@/lib/financial-runtime/types'

/**
 * Merges financial runtime summary into operational intelligence snapshot.
 */
export function attachFinancialRuntimeToOperationalIntelligence(
  intelligence: VisitOperationalIntelligence,
  financial: VisitFinancialRuntime | null,
): VisitOperationalIntelligence {
  if (!financial) return intelligence

  return {
    ...intelligence,
    snapshot: {
      ...intelligence.snapshot,
      financialRuntime: {
        expected: financial.expected.procedureCount,
        executed: financial.executed.procedureCompletedCount,
        earned: financial.earned.procedureEarnedCount,
        leakageScore: financial.leakageScore,
        earnedRateBasisPoints: financial.earnedRateBasisPoints,
      },
    },
  }
}
