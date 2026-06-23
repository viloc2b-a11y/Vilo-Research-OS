import { describe, expect, it } from 'vitest'
import { evaluateBudgetReadiness, type BudgetReadinessInput } from './budget-readiness'

function makeInput(over: Partial<BudgetReadinessInput> = {}): BudgetReadinessInput {
  return {
    hasAcceptedTerms: true,
    hasSponsorOfferOnly: false,
    hasCounterofferOnly: false,
    criticalUnpricedCount: 0,
    noncriticalGapCount: 0,
    hasExpectedBillables: true,
    missingUnitCostCount: 0,
    hasFinancialRuntimeEvidence: true,
    hasChargemaster: true,
    hasNegotiationLedger: true,
    hasDisputedItems: false,
    disputedCount: 0,
    totalUnpriced: 0,
    ...over,
  }
}

describe('evaluateBudgetReadiness', () => {
  it('returns ready when all budget data is healthy', () => {
    const result = evaluateBudgetReadiness(makeInput())
    expect(result.status).toBe('ready')
    expect(result.score).toBe(90) // baseline 90 with accepted terms
    expect(result.blockers).toHaveLength(0)
  })

  it('returns warning with no financial data detected', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasAcceptedTerms: false,
      hasSponsorOfferOnly: false,
      hasCounterofferOnly: false,
      hasNegotiationLedger: false,
      hasChargemaster: false,
    }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('No financial data'))).toBe(true)
  })

  it('returns blocked with sponsor offer only (no acceptance)', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasAcceptedTerms: false,
      hasSponsorOfferOnly: true,
      hasCounterofferOnly: false,
      hasNegotiationLedger: true,
      hasChargemaster: false,
    }))
    expect(result.status).toBe('blocked')
    expect(result.score).toBeLessThan(50)
    expect(result.blockers.some((b) => b.message.includes('Sponsor offer'))).toBe(true)
  })

  it('returns blocked with counteroffer only (no acceptance)', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasAcceptedTerms: false,
      hasSponsorOfferOnly: false,
      hasCounterofferOnly: true,
      hasNegotiationLedger: true,
      hasChargemaster: false,
    }))
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('Counteroffer'))).toBe(true)
  })

  it('returns blocked with no accepted terms and no activity', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasAcceptedTerms: false,
      hasSponsorOfferOnly: false,
      hasCounterofferOnly: false,
      hasNegotiationLedger: false,
      hasChargemaster: true,
    }))
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('accepted financial terms'))).toBe(true)
  })

  it('returns blocked with critical unpriced items', () => {
    const result = evaluateBudgetReadiness(makeInput({
      criticalUnpricedCount: 3,
      totalUnpriced: 3,
    }))
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('unpriced'))).toBe(true)
  })

  it('returns warning with noncritical unpriced gaps', () => {
    const result = evaluateBudgetReadiness(makeInput({ noncriticalGapCount: 2 }))
    expect(result.status).toBe('warning')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.blockers.some((b) => b.message.includes('pricing gap'))).toBe(true)
  })

  it('returns warning when accepted terms exist but expected billables missing', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasExpectedBillables: false,
    }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('expected billables'))).toBe(true)
  })

  it('returns warning when invoiceable items missing unitCost', () => {
    const result = evaluateBudgetReadiness(makeInput({ missingUnitCostCount: 4 }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('unit cost'))).toBe(true)
  })

  it('returns warning when disputed items exist', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasDisputedItems: true,
      disputedCount: 2,
    }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('disputed'))).toBe(true)
  })

  it('score is clamped between 0 and 100', () => {
    const result = evaluateBudgetReadiness(makeInput({
      hasAcceptedTerms: false,
      hasSponsorOfferOnly: false,
      hasCounterofferOnly: false,
      hasNegotiationLedger: false,
      hasChargemaster: false,
      criticalUnpricedCount: 10,
    }))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
