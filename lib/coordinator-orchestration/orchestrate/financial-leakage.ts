import type { FinancialLeakageEscalation } from '@/lib/coordinator-orchestration/types'
import type { RevenueLeakageItem } from '@/lib/financial-runtime/types'

export function orchestrateFinancialLeakageEscalation(input: {
  leakageItems: RevenueLeakageItem[]
  leakageScore: number
  topLeakageLabels?: string[]
}): FinancialLeakageEscalation {
  const criticalLeakageCount = input.leakageItems.filter((l) => l.severity === 'critical').length
  const topLeakageKinds = [
    ...new Set(input.leakageItems.slice(0, 5).map((l) => l.kind)),
  ]

  const recommendedActions: string[] = []
  if (input.leakageItems.some((l) => l.kind === 'executed_unsigned')) {
    recommendedActions.push('Complete procedure signatures to close leakage')
  }
  if (input.leakageItems.some((l) => l.kind === 'completed_missing_source')) {
    recommendedActions.push('Submit source for billable completed procedures')
  }
  if (input.leakageItems.some((l) => l.kind === 'completed_unresolved_findings')) {
    recommendedActions.push('Resolve findings before earnable closeout')
  }
  if (input.leakageItems.some((l) => l.kind === 'unscheduled_burden')) {
    recommendedActions.push('Review scheduling deviation and coordinator burden')
  }
  if (recommendedActions.length === 0 && input.leakageScore > 0) {
    recommendedActions.push('Review financial runtime leakage report')
  }

  return {
    leakageScore: input.leakageScore,
    criticalLeakageCount,
    topLeakageKinds,
    recommendedActions: recommendedActions.slice(0, 5),
  }
}
