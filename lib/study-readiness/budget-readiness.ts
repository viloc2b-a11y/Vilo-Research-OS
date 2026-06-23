import type { ReadinessDomain, ReadinessBlocker } from './study-readiness'

// ── Input type ───────────────────────────────────────────────────────────────

export type BudgetReadinessInput = {
  /** Are there accepted financial terms? */
  hasAcceptedTerms: boolean
  /** Are there sponsor offers (no acceptance)? */
  hasSponsorOfferOnly: boolean
  /** Are there counteroffers (no acceptance)? */
  hasCounterofferOnly: boolean
  /** Number of critical unpriced line items */
  criticalUnpricedCount: number
  /** Number of non-critical unpriced gaps */
  noncriticalGapCount: number
  /** Do expected billables exist? */
  hasExpectedBillables: boolean
  /** Number of invoiceable items with null unitCost */
  missingUnitCostCount: number
  /** Is financial runtime smoke/evidence available? */
  hasFinancialRuntimeEvidence: boolean
  /** Has a chargemaster been defined? */
  hasChargemaster: boolean
  /** Has a budget negotiation ledger been started? */
  hasNegotiationLedger: boolean
  /** Are there any disputed/void/reversed items? */
  hasDisputedItems: boolean
  /** Number of disputed items */
  disputedCount: number
  /** Total unpriced line items count */
  totalUnpriced: number
}

// ── Pure evaluator ───────────────────────────────────────────────────────────

export function evaluateBudgetReadiness(input: BudgetReadinessInput): ReadinessDomain {
  const blockers: ReadinessBlocker[] = []

  // ── 1. No financial data detected → warning ──
  if (!input.hasAcceptedTerms && !input.hasSponsorOfferOnly && !input.hasCounterofferOnly
      && !input.hasNegotiationLedger && !input.hasChargemaster) {
    blockers.push({
      domain: 'budget',
      severity: 'warning',
      message: 'No financial data detected — budget setup may not have started',
    })
    return { domain: 'budget', status: 'warning', score: 50, blockers }
  }

  // If we have accepted terms, start from a high baseline
  let score = input.hasAcceptedTerms ? 90 : 40

  // ── 2. No accepted terms with only sponsor offer → blocked ──
  if (!input.hasAcceptedTerms && input.hasSponsorOfferOnly && !input.hasCounterofferOnly) {
    blockers.push({
      domain: 'budget',
      severity: 'critical',
      message: 'Sponsor offer received but no accepted terms — negotiate and accept',
    })
    score = Math.min(score, 20)
  }

  // ── 3. No accepted terms with only counteroffer → blocked ──
  if (!input.hasAcceptedTerms && input.hasCounterofferOnly) {
    blockers.push({
      domain: 'budget',
      severity: 'critical',
      message: 'Counteroffer submitted but no accepted terms — awaiting sponsor response',
    })
    score = Math.min(score, 15)
  }

  // ── 4. No accepted terms and no activity → blocked ──
  if (!input.hasAcceptedTerms && !input.hasSponsorOfferOnly && !input.hasCounterofferOnly) {
    blockers.push({
      domain: 'budget',
      severity: 'critical',
      message: 'No accepted financial terms — budget negotiation not complete',
    })
    score = Math.min(score, 10)
  }

  // ── 5. Critical unpriced items → blocked ──
  if (input.criticalUnpricedCount > 0) {
    blockers.push({
      domain: 'budget',
      severity: 'critical',
      message: `${input.criticalUnpricedCount} critical line item(s) unpriced`,
    })
    score = Math.min(score, 25)
  }

  // ── 6. Noncritical unpriced gaps → warning ──
  if (input.noncriticalGapCount > 0) {
    blockers.push({
      domain: 'budget',
      severity: 'warning',
      message: `${input.noncriticalGapCount} non-critical pricing gap(s) unresolved`,
    })
    score = Math.min(score, 60)
  }

  // ── 7. Accepted terms exist but expected billables missing → warning ──
  if (input.hasAcceptedTerms && !input.hasExpectedBillables) {
    blockers.push({
      domain: 'budget',
      severity: 'warning',
      message: 'Accepted terms exist but expected billables not computed',
    })
    score = Math.min(score, 65)
  }

  // ── 8. Missing unitCost on invoiceable items → warning ──
  if (input.missingUnitCostCount > 0) {
    blockers.push({
      domain: 'budget',
      severity: 'warning',
      message: `${input.missingUnitCostCount} invoiceable item(s) missing unit cost`,
    })
    score = Math.min(score, 55)
  }

  // ── 9. Disputed items exist → warning ──
  if (input.hasDisputedItems) {
    blockers.push({
      domain: 'budget',
      severity: 'warning',
      message: `${input.disputedCount} disputed/void/reversed item(s) require attention`,
    })
    score = Math.min(score, 60)
  }

  // Clamp and determine status
  score = Math.max(0, Math.min(100, score))

  const hasCritical = blockers.some((b) => b.severity === 'critical')
  const hasWarning = blockers.some((b) => b.severity === 'warning')
  const status = hasCritical ? 'blocked' : hasWarning ? 'warning' : 'ready'

  return { domain: 'budget', status, score, blockers }
}

// ── Server loader ────────────────────────────────────────────────────────────

export async function loadBudgetReadinessDomain(studyId: string): Promise<ReadinessDomain> {
  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()

  // Check negotiation events
  const [{ count: acceptedCount }, { count: offerCount }, { count: counterofferCount }] =
    await Promise.all([
      supabase.from('study_budget_negotiation_events').select('id', { count: 'exact', head: true })
        .eq('study_id', studyId).eq('event_type', 'terms_accepted').limit(1),
      supabase.from('study_budget_negotiation_events').select('id', { count: 'exact', head: true })
        .eq('study_id', studyId).eq('event_type', 'sponsor_offer').limit(1),
      supabase.from('study_budget_negotiation_events').select('id', { count: 'exact', head: true })
        .eq('study_id', studyId).in('event_type', ['counteroffer', 'site_counteroffer']).limit(1),
    ])

  // Check chargemaster and line items
  const [{ count: chargemasterCount }, { count: unpricedCount }, { count: nullUnitCostCount }] =
    await Promise.all([
      supabase.from('site_chargemaster').select('id', { count: 'exact', head: true }).eq('study_id', studyId).limit(1),
      supabase.from('study_budget_negotiation_line_items').select('id', { count: 'exact', head: true })
        .eq('study_id', studyId).is('unit_cost', null).limit(1),
      supabase.from('financial_invoiceable_line_items').select('id', { count: 'exact', head: true })
        .eq('study_id', studyId).is('unit_cost', null).limit(1),
    ])

  // Check expected billables / financial runtime evidence
  const [{ data: expectedRows }, { data: disputedRows }] = await Promise.all([
    supabase.from('financial_expected_billables').select('id').eq('study_id', studyId).limit(1),
    supabase.from('study_budget_negotiation_events').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).in('event_type', ['dispute', 'void', 'reversed']),
  ])

  const input: BudgetReadinessInput = {
    hasAcceptedTerms: (acceptedCount ?? 0) > 0,
    hasSponsorOfferOnly: (offerCount ?? 0) > 0 && (acceptedCount ?? 0) === 0,
    hasCounterofferOnly: (counterofferCount ?? 0) > 0 && (acceptedCount ?? 0) === 0,
    criticalUnpricedCount: unpricedCount ?? 0,
    noncriticalGapCount: 0, // simplified — would need detailed gap analysis
    hasExpectedBillables: (expectedRows?.length ?? 0) > 0,
    missingUnitCostCount: nullUnitCostCount ?? 0,
    hasFinancialRuntimeEvidence: (expectedRows?.length ?? 0) > 0,
    hasChargemaster: (chargemasterCount ?? 0) > 0,
    hasNegotiationLedger: (acceptedCount ?? 0) > 0 || (offerCount ?? 0) > 0,
    hasDisputedItems: (disputedRows?.length ?? 0) > 0,
    disputedCount: disputedRows?.length ?? 0,
    totalUnpriced: unpricedCount ?? 0,
  }

  return evaluateBudgetReadiness(input)
}
