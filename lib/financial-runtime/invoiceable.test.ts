import { describe, expect, it } from 'vitest'
import { buildInvoiceableLineItems, resolveProcedurePricing } from './invoiceable'
import type { VisitFinancialRuntime } from '@/lib/financial-runtime/types'

function createSupabasePricingStub(events: Array<Record<string, unknown>>) {
  const query = {
    select: () => query,
    eq: () => query,
    in: (_column: string, values: string[]) => {
      query.selectedEventTypes = values
      return query
    },
    order: () => query,
    limit: () =>
      Promise.resolve({
        data: events.filter((event) =>
          query.selectedEventTypes.includes(String(event.event_type)),
        ),
        error: null,
      }),
    selectedEventTypes: [] as string[],
  }

  return {
    from: (table: string) => {
      expect(table).toBe('study_budget_negotiation_events')
      return query
    },
  }
}

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

  it('does not price invoiceables from sponsor offer evidence alone', async () => {
    const pricing = await resolveProcedurePricing({
      supabase: createSupabasePricingStub([
        {
          id: 'sponsor-offer-1',
          event_type: 'sponsor_offer_received',
          event_payload: {
            line_items: [{ label: 'Procedure A', category: 'procedure', amount: 600 }],
          },
        },
      ]) as never,
      studyId: 'study-1',
      earnedBillableCount: 2,
    })

    expect(pricing).toEqual({ pricingEventId: null, unitCost: null })
  })

  it('does not price invoiceables from counteroffer evidence alone', async () => {
    const pricing = await resolveProcedurePricing({
      supabase: createSupabasePricingStub([
        {
          id: 'counteroffer-1',
          event_type: 'counteroffer_sent',
          event_payload: {
            line_items: [{ label: 'Procedure A', category: 'procedure', amount: 600 }],
          },
        },
      ]) as never,
      studyId: 'study-1',
      earnedBillableCount: 2,
    })

    expect(pricing).toEqual({ pricingEventId: null, unitCost: null })
  })

  it('prices invoiceables from accepted terms', async () => {
    const pricing = await resolveProcedurePricing({
      supabase: createSupabasePricingStub([
        {
          id: 'accepted-term-1',
          event_type: 'term_accepted',
          event_payload: {
            line_items: [{ label: 'Procedure A', category: 'procedure', amount: 600 }],
          },
        },
      ]) as never,
      studyId: 'study-1',
      earnedBillableCount: 2,
    })

    expect(pricing).toEqual({ pricingEventId: 'accepted-term-1', unitCost: 300 })
  })

  it('requires explicit pricing approval before adjusted terms can price invoiceables', async () => {
    const pricing = await resolveProcedurePricing({
      supabase: createSupabasePricingStub([
        {
          id: 'draft-adjustment-1',
          event_type: 'term_adjusted',
          event_payload: {
            line_items: [{ label: 'Procedure A', category: 'procedure', amount: 900 }],
          },
        },
        {
          id: 'effective-adjustment-1',
          event_type: 'term_adjusted',
          event_payload: {
            approved_for_pricing: true,
            line_items: [{ label: 'Procedure A', category: 'procedure', amount: 600 }],
          },
        },
      ]) as never,
      studyId: 'study-1',
      earnedBillableCount: 2,
    })

    expect(pricing).toEqual({ pricingEventId: 'effective-adjustment-1', unitCost: 300 })
  })

  it('prices the lifecycle from accepted terms after sponsor offer and counteroffer evidence', async () => {
    const pricing = await resolveProcedurePricing({
      supabase: createSupabasePricingStub([
        {
          id: 'sponsor-offer-1',
          event_type: 'sponsor_offer_received',
          event_payload: {
            evidence_only: true,
            line_items: [{ label: 'Sponsor proposed procedure', category: 'procedure', amount: 200 }],
          },
        },
        {
          id: 'counteroffer-1',
          event_type: 'counteroffer_sent',
          event_payload: {
            evidence_only: true,
            line_items: [{ label: 'Countered procedure', category: 'procedure', amount: 500 }],
          },
        },
        {
          id: 'accepted-term-1',
          event_type: 'term_accepted',
          event_payload: {
            accepted_financial_term: true,
            line_items: [{ label: 'Accepted procedure', category: 'procedure', amount: 600 }],
          },
        },
      ]) as never,
      studyId: 'study-1',
      earnedBillableCount: 2,
    })

    expect(pricing).toEqual({ pricingEventId: 'accepted-term-1', unitCost: 300 })
  })
})
