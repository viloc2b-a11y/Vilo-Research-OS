import { describe, expect, it } from 'vitest'
import { buildInvoiceableLineItems } from './invoiceable'
import type { VisitFinancialRuntime } from '@/lib/financial-runtime/types'

describe('invoiceable runtime', () => {
  it('materializes earned procedure components into invoiceable line items', () => {
    const financial = {
      organizationId: 'org-1',
      studyId: 'study-1',
      studySubjectId: 'subject-1',
      visitId: 'visit-1',
      computedAt: '2026-06-04T12:00:00.000Z',
      financialVersion: 1,
      paymentLifecycle: {
        subjectEnrollmentStatus: 'enrolled',
        screenFailure: false,
        visitPaymentEligible: true,
        visitPaymentExclusionReason: null,
        expectedComponentCount: 3,
        earnedComponentCount: 1,
        invoiceableComponentCount: 1,
        components: [
          {
            id: 'visit-payment:visit-1',
            componentType: 'visit_payment',
            lifecycleStatus: 'expected',
            eligible: true,
            quantity: 1,
            label: 'Visit payment',
            detail: 'Visit-level payment remains expected until earned/invoiced data is available.',
            exclusionReason: null,
          },
          {
            id: 'procedure-payment:proc-1',
            componentType: 'procedure_payment',
            lifecycleStatus: 'earned',
            eligible: true,
            quantity: 1,
            label: 'Procedure A',
            detail: 'Billable procedure has reached earned state.',
            procedureExecutionId: 'proc-1',
            exclusionReason: null,
          },
          {
            id: 'procedure-payment:proc-2',
            componentType: 'procedure_payment',
            lifecycleStatus: 'expected',
            eligible: true,
            quantity: 1,
            label: 'Procedure B',
            detail: 'Billable procedure is not earned yet.',
            procedureExecutionId: 'proc-2',
            exclusionReason: null,
          },
        ],
      },
    } as unknown as VisitFinancialRuntime

    const rows = buildInvoiceableLineItems({
      financial,
      visitName: 'Baseline Visit',
      unitCost: 375.5,
      pricingEventId: 'pricing-event-1',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      organization_id: 'org-1',
      study_id: 'study-1',
      study_subject_id: 'subject-1',
      visit_id: 'visit-1',
      procedure_execution_id: 'proc-1',
      pricing_event_id: 'pricing-event-1',
      visit_name: 'Baseline Visit',
      activity_id: 'proc-1',
      activity_type: 'procedure_payment',
      description: 'Procedure A',
      billable_to: 'sponsor',
      quantity: 1,
      unit_cost: 375.5,
      amount: 375.5,
      currency: 'USD',
      invoice_status: 'invoiceable',
      source_state: 'earned',
      source_financial_version: 1,
      source_computed_at: '2026-06-04T12:00:00.000Z',
      earned_at: '2026-06-04T12:00:00.000Z',
    })
  })
})
