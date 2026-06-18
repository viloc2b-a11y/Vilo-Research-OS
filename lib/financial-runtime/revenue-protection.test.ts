import { describe, expect, it } from 'vitest'
import { computeRevenueProtection } from './revenue-protection'
import type { StudyBudgetEvidenceSummary } from '@/lib/study-workspace/load-budget-evidence-summary'
import type { StudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import type { StudyInvoiceSummary } from './study-invoice-summary'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildMinimalSummary(
  overrides: Partial<StudyBudgetEvidenceSummary> = {},
): StudyBudgetEvidenceSummary {
  return {
    budgetDocumentCount: null,
    contractDocumentCount: null,
    budgetChunkCount: null,
    contractChunkCount: null,
    activeBudgetReferenceCount: null,
    activeContractReferenceCount: null,
    paymentTermsHintCount: null,
    invoiceDueHintCount: null,
    passThroughHintCount: null,
    screenFailureHintCount: null,
    invoiceableProcedureHintCount: null,
    negotiationFocusAreas: [],
    soaComparison: {
      visitCount: null,
      procedureCount: null,
      conditionalProcedureCount: null,
      requiredProcedureCount: null,
      summary: '',
    },
    counterofferDraft: { title: '', summary: '', items: [] },
    negotiationLedger: [],
    negotiationReadiness: 'blocked',
    negotiationReason: '',
    negotiationNextStep: '',
    negotiationState: {
      key: 'missing_evidence',
      label: '',
      nextStep: '',
      sequence: [],
    },
    budgetIntelligence: {
      fmvGap: {
        level: 'unknown',
        summary: '',
        details: [],
        benchmarkFamily: 'unclassified',
        benchmarkUsd: null,
        sponsorOfferUsd: null,
        gapUsd: null,
      },
      operationalBurdenGap: {
        level: 'unknown',
        summary: '',
        details: [],
        missingRequiredProcedureLineItems: null,
        procedureLineItemCount: null,
      },
      paymentTermRisk: { level: 'unknown', summary: '', details: [] },
      passThroughRisk: { level: 'unknown', summary: '', details: [] },
      screenFailureProtectionGap: { level: 'unknown', summary: '', details: [] },
      recommendedCounterofferLanguage: [],
      projectedRevenueImpact: {
        benchmarkUsd: null,
        sponsorOfferUsd: null,
        projectedDeltaUsd: null,
        summary: '',
      },
    },
    unavailable: [],
    ...overrides,
  }
}

function buildAcceptedTermSummary(unitCostPerProcedure: number): StudyBudgetEvidenceSummary {
  return buildMinimalSummary({
    negotiationLedger: [
      {
        id: 'accepted-term-1',
        eventType: 'term_accepted',
        title: 'Procedure terms accepted',
        summary: 'Sponsor accepted procedure pricing.',
        reason: null,
        recommendedNextStep: null,
        ownerRole: 'coordinator',
        negotiationRound: 1,
        protocolVersionId: null,
        studySubjectId: null,
        visitId: null,
        procedureId: null,
        sourceDocumentId: null,
        sourceChunkId: null,
        actorUserId: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        linkedObjects: [],
        lineItems: [
          {
            label: 'CBC procedure',
            category: 'procedure',
            amount: unitCostPerProcedure,
            currency: 'USD',
            note: null,
            status: 'accepted',
            financialTruth: true,
          },
        ],
        eventPayload: { accepted_financial_term: true },
      },
    ],
  })
}

function buildExecutionData(
  overrides: Partial<StudyFinancialRuntimeSummary> = {},
): StudyFinancialRuntimeSummary {
  return {
    projectionCount: 10,
    leakageVisitCount: 0,
    expectedProcedureCount: 20,
    executedProcedureCount: 18,
    earnedProcedureCount: 15,
    leakageItemCount: 3,
    averageEarnedRateBasisPoints: 7500,
    maxLeakageScore: 0,
    sampleLimit: 500,
    unavailable: [],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeRevenueProtection', () => {
  it('returns null for all pipeline stages when no accepted terms exist', () => {
    const summary = buildMinimalSummary() // empty negotiationLedger
    const result = computeRevenueProtection(summary, null)

    expect(result.expected_revenue).toBeNull()
    expect(result.executed_work_count).toBeNull()
    expect(result.earned_revenue).toBeNull()
    expect(result.invoiced_amount).toBeNull()
    expect(result.paid_amount).toBeNull()
    expect(result.leakage.expected_vs_earned).toBeNull()
    expect(result.leakage.earned_vs_invoiced).toBeNull()
    expect(result.leakage.invoiced_vs_paid).toBeNull()
  })

  it('computes expected revenue from accepted unit cost × expected procedure count', () => {
    const summary = buildAcceptedTermSummary(300) // $300 accepted per procedure
    const execution = buildExecutionData({ expectedProcedureCount: 20 })
    const result = computeRevenueProtection(summary, execution)

    // $300 × 20 expected = $6,000
    expect(result.expected_revenue).toBe(6000)
  })

  it('computes earned revenue from accepted unit cost × earned procedure count', () => {
    const summary = buildAcceptedTermSummary(300)
    const execution = buildExecutionData({ expectedProcedureCount: 20, earnedProcedureCount: 15 })
    const result = computeRevenueProtection(summary, execution)

    // $300 × 15 earned = $4,500
    expect(result.earned_revenue).toBe(4500)
  })

  it('computes leakage expected_vs_earned when both values are available', () => {
    const summary = buildAcceptedTermSummary(300)
    const execution = buildExecutionData({
      expectedProcedureCount: 20,
      earnedProcedureCount: 15,
    })
    const result = computeRevenueProtection(summary, execution)

    // $6,000 expected − $4,500 earned = $1,500 at risk
    expect(result.leakage.expected_vs_earned).toBe(1500)
  })

  it('returns null for leakage when either side is null', () => {
    // accepted terms exist but no execution data
    const summary = buildAcceptedTermSummary(300)
    const result = computeRevenueProtection(summary, null)

    expect(result.expected_revenue).toBeNull() // no expectedProcedureCount
    expect(result.earned_revenue).toBeNull() // no earnedProcedureCount
    expect(result.leakage.expected_vs_earned).toBeNull()
  })

  it('always returns null for invoiced and paid amounts — no fabrication', () => {
    const summary = buildAcceptedTermSummary(500)
    const execution = buildExecutionData()
    const result = computeRevenueProtection(summary, execution)

    // These are null until study-level invoice/payment aggregation is wired
    expect(result.invoiced_amount).toBeNull()
    expect(result.paid_amount).toBeNull()
    expect(result.leakage.earned_vs_invoiced).toBeNull()
    expect(result.leakage.invoiced_vs_paid).toBeNull()
  })

  it('populates expected revenue but not earned when only expectedProcedureCount is available', () => {
    const summary = buildAcceptedTermSummary(400)
    const execution = buildExecutionData({
      expectedProcedureCount: 10,
      executedProcedureCount: 8,
      earnedProcedureCount: null, // not yet computed
    })
    const result = computeRevenueProtection(summary, execution)

    expect(result.expected_revenue).toBe(4000) // $400 × 10
    expect(result.earned_revenue).toBeNull() // earnedProcedureCount is null
    expect(result.executed_work_count).toBe(8)
    expect(result.leakage.expected_vs_earned).toBeNull()
  })

  // ── Invoice Summary Tests (Sprint 6B.2) ──────────────────────────────────

  it('populates invoiced_amount and paid_amount when invoice summary is provided', () => {
    const summary = buildAcceptedTermSummary(300)
    const execution = buildExecutionData({ expectedProcedureCount: 20, earnedProcedureCount: 15 })
    const invoiceSummary: StudyInvoiceSummary = {
      invoicedAmount: 8000,
      paidAmount: 6000,
      invoiceCount: 5,
      paymentCount: 3,
      latestInvoiceDate: '2026-06-01T00:00:00.000Z',
      latestPaymentDate: '2026-06-10T00:00:00.000Z',
    }
    const result = computeRevenueProtection(summary, execution, invoiceSummary)

    expect(result.invoiced_amount).toBe(8000)
    expect(result.paid_amount).toBe(6000)
    expect(result.leakage.invoiced_vs_paid).toBe(2000) // 8000 − 6000
  })

  it('returns null for invoiced_vs_paid when paid_amount is null', () => {
    const summary = buildAcceptedTermSummary(300)
    const execution = buildExecutionData({ expectedProcedureCount: 20, earnedProcedureCount: 15 })
    const invoiceSummary: StudyInvoiceSummary = {
      invoicedAmount: 8000,
      paidAmount: null,
      invoiceCount: 5,
      paymentCount: 0,
      latestInvoiceDate: '2026-06-01T00:00:00.000Z',
      latestPaymentDate: null,
    }
    const result = computeRevenueProtection(summary, execution, invoiceSummary)

    expect(result.invoiced_amount).toBe(8000)
    expect(result.paid_amount).toBeNull()
    expect(result.leakage.invoiced_vs_paid).toBeNull()
  })

  it('preserves null invoiced_amount and paid_amount when invoice summary is null (pre-6B.2 behavior)', () => {
    const summary = buildAcceptedTermSummary(500)
    const execution = buildExecutionData()
    const result = computeRevenueProtection(summary, execution, null)

    expect(result.invoiced_amount).toBeNull()
    expect(result.paid_amount).toBeNull()
    expect(result.leakage.earned_vs_invoiced).toBeNull()
    expect(result.leakage.invoiced_vs_paid).toBeNull()
  })

  it('computes earned_vs_invoiced leakage when earned revenue exceeds invoiced amount', () => {
    // $300 × 20 earned = $6,000 earned; invoiced only $4,500 → $1,500 uninvoiced
    const summary = buildAcceptedTermSummary(300)
    const execution = buildExecutionData({ expectedProcedureCount: 20, earnedProcedureCount: 20 })
    const invoiceSummary: StudyInvoiceSummary = {
      invoicedAmount: 4500,
      paidAmount: 4500,
      invoiceCount: 3,
      paymentCount: 3,
      latestInvoiceDate: '2026-06-01T00:00:00.000Z',
      latestPaymentDate: '2026-06-10T00:00:00.000Z',
    }
    const result = computeRevenueProtection(summary, execution, invoiceSummary)

    expect(result.earned_revenue).toBe(6000) // $300 × 20
    expect(result.invoiced_amount).toBe(4500)
    expect(result.leakage.earned_vs_invoiced).toBe(1500) // 6000 − 4500
  })

  it('uses only procedure line items with financialTruth=true for unit cost derivation', () => {
    // A ledger with a sponsor_offer (financialTruth=false) followed by term_accepted (financialTruth=true)
    const summary = buildMinimalSummary({
      negotiationLedger: [
        {
          id: 'accepted-term-1',
          eventType: 'term_accepted',
          title: 'Terms accepted',
          summary: 'Accepted.',
          reason: null,
          recommendedNextStep: null,
          ownerRole: 'coordinator',
          negotiationRound: 2,
          protocolVersionId: null,
          studySubjectId: null,
          visitId: null,
          procedureId: null,
          sourceDocumentId: null,
          sourceChunkId: null,
          actorUserId: null,
          createdAt: '2026-06-02T00:00:00.000Z',
          linkedObjects: [],
          lineItems: [
            {
              label: 'CBC',
              category: 'procedure',
              amount: 600,
              currency: 'USD',
              note: null,
              status: 'accepted',
              financialTruth: true,
            },
          ],
          eventPayload: {},
        },
        {
          id: 'sponsor-offer-1',
          eventType: 'sponsor_offer_received',
          title: 'Sponsor offer',
          summary: 'Low-ball offer.',
          reason: null,
          recommendedNextStep: null,
          ownerRole: 'sponsor',
          negotiationRound: 1,
          protocolVersionId: null,
          studySubjectId: null,
          visitId: null,
          procedureId: null,
          sourceDocumentId: null,
          sourceChunkId: null,
          actorUserId: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          linkedObjects: [],
          lineItems: [
            {
              label: 'CBC',
              category: 'procedure',
              amount: 125, // sponsor offer — must NOT be used for pricing
              currency: 'USD',
              note: null,
              status: 'proposed',
              financialTruth: false,
            },
          ],
          eventPayload: {},
        },
      ],
    })

    const execution = buildExecutionData({ expectedProcedureCount: 5, earnedProcedureCount: 5 })
    const result = computeRevenueProtection(summary, execution)

    // Must use $600 (accepted), not $125 (sponsor offer)
    expect(result.expected_revenue).toBe(3000) // $600 × 5
    expect(result.earned_revenue).toBe(3000) // $600 × 5
  })
})
