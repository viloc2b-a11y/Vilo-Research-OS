import type {
  EarnedFinancialState,
  ExecutedFinancialState,
  ExpectedFinancialState,
  FinancialIntegritySafeguard,
} from '@/lib/financial-runtime/types'

export function evaluateFinancialIntegritySafeguards(input: {
  expected: ExpectedFinancialState
  executed: ExecutedFinancialState
  earned: EarnedFinancialState
  hasProtocolGraph: boolean
}): FinancialIntegritySafeguard[] {
  const safeguards: FinancialIntegritySafeguard[] = []

  if (input.earned.procedureEarnedCount > input.executed.procedureCompletedCount) {
    safeguards.push({
      id: 'safeguard:earned-exceeds-executed',
      severity: 'error',
      label: 'Earned exceeds executed',
      detail: 'Derived earned count cannot exceed completed procedures.',
    })
  }

  if (input.earned.billableEarnedCount > input.executed.procedureBillableCompletedCount) {
    safeguards.push({
      id: 'safeguard:billable-earned-exceeds',
      severity: 'error',
      label: 'Billable earned exceeds billable executed',
      detail: 'Billable earned units exceed billable completed procedures.',
    })
  }

  if (!input.hasProtocolGraph && input.expected.procedureCount > 0) {
    safeguards.push({
      id: 'safeguard:no-protocol-graph',
      severity: 'warning',
      label: 'No published protocol graph',
      detail: 'Expected units computed from definitions only; graph compliance degraded.',
    })
  }

  if (input.expected.procedureCount === 0 && input.executed.procedureCompletedCount > 0) {
    safeguards.push({
      id: 'safeguard:executed-without-expected',
      severity: 'warning',
      label: 'Execution without protocol expected set',
      detail: 'Completed procedures exist but visit definition has no mapped expected procedures.',
    })
  }

  return safeguards
}
