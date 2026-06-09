import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type {
  EarnedFinancialState,
  FinancialPaymentLifecycle,
  FinancialRevenueComponent,
  PaymentLifecycleStatus,
} from '@/lib/financial-runtime/types'

function componentStatus(earned: boolean, expected: boolean): PaymentLifecycleStatus {
  if (earned) return 'earned'
  return expected ? 'expected' : 'written_off'
}

export function computePaymentLifecycle(input: {
  ctx: VisitFinancialContext
  earned: EarnedFinancialState
}): FinancialPaymentLifecycle {
  const { ctx, earned } = input
  const screenFailure = ctx.subjectEnrollmentStatus === 'screen_failed'
  const visitPaymentEligible = !screenFailure
  const components: FinancialRevenueComponent[] = []

  components.push({
    id: `visit-payment:${ctx.visitId}`,
    componentType: 'visit_payment',
    lifecycleStatus: visitPaymentEligible ? 'expected' : 'written_off',
    eligible: visitPaymentEligible,
    quantity: visitPaymentEligible ? 1 : 0,
    label: 'Visit payment',
    detail: visitPaymentEligible
      ? 'Visit-level payment remains expected until earned/invoiced data is available.'
      : 'Screen failure visit payment is modeled as $0; procedure revenue remains independent.',
    exclusionReason: visitPaymentEligible ? null : 'screen_failure_zero_visit_payment',
  })

  for (const unit of earned.units) {
    if (!unit.billable) continue
    components.push({
      id: `procedure-payment:${unit.procedureExecutionId ?? unit.procedureDefinitionId}`,
      componentType: 'procedure_payment',
      lifecycleStatus: componentStatus(unit.earned, true),
      eligible: true,
      quantity: 1,
      label: unit.procedureLabel,
      detail: unit.earned
        ? 'Billable procedure has reached earned state.'
        : `Billable procedure is not earned yet: ${unit.earnBlockers.join(', ') || 'pending runtime evidence'}.`,
      procedureExecutionId: unit.procedureExecutionId,
      exclusionReason: null,
    })
  }

  const expectedComponentCount = components.filter((c) => c.eligible).length
  const earnedComponentCount = components.filter((c) => c.lifecycleStatus === 'earned').length

  return {
    subjectEnrollmentStatus: ctx.subjectEnrollmentStatus,
    screenFailure,
    visitPaymentEligible,
    visitPaymentExclusionReason: visitPaymentEligible ? null : 'screen_failure_zero_visit_payment',
    expectedComponentCount,
    earnedComponentCount,
    invoiceableComponentCount: earnedComponentCount,
    components,
  }
}
