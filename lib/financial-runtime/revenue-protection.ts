/**
 * Revenue Protection computation for the ClinIQ Financial module.
 *
 * Computes the Expected → Executed → Earned → Invoiced → Paid pipeline
 * from data that already exists in the negotiation ledger and financial
 * runtime summary. Returns null for any stage where real data does not exist.
 *
 * NO fabricated numbers, NO assumptions. Only real data drives values.
 */

import type { StudyBudgetEvidenceSummary } from '@/lib/study-workspace/load-budget-evidence-summary'
import type { StudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import type { StudyInvoiceSummary } from '@/lib/financial-runtime/study-invoice-summary'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Aggregated execution data from the financial runtime summary.
 * All fields are counts from `visit_financial_runtime_projections`.
 */
export type StudyExecutionData = {
  /** Total expected (billable) procedure count across all visited subjects */
  expectedProcedureCount: number | null
  /** Total executed procedure count (completed, regardless of earn eligibility) */
  executedProcedureCount: number | null
  /** Total earned procedure count (eligible, compliant, invoiceable) */
  earnedProcedureCount: number | null
}

export type RevenueLeakageSummary = {
  /** Expected revenue minus earned revenue (money at risk due to execution gaps) */
  expected_vs_earned: number | null
  /** Earned revenue minus invoiced amount (billable work not yet invoiced) */
  earned_vs_invoiced: number | null
  /** Invoiced amount minus paid amount (outstanding receivables) */
  invoiced_vs_paid: number | null
}

export type RevenueProtectionSummary = {
  /** Accepted unit cost × planned (expected) procedure count */
  expected_revenue: number | null
  /** Total confirmed-executed procedure count (not revenue — quantity only) */
  executed_work_count: number | null
  /** Accepted unit cost × earned procedure count */
  earned_revenue: number | null
  /**
   * Invoiced: null unless a future invoice aggregation feed is wired.
   * The financial_invoices table exists per-visit; a study-level rollup
   * is not yet loaded through the StudyBudgetEvidenceSummary path.
   */
  invoiced_amount: number | null
  /**
   * Paid: null for the same reason as invoiced — no study-level payment
   * aggregation is available through the current summary pipeline.
   */
  paid_amount: number | null
  leakage: RevenueLeakageSummary
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Derive the accepted unit cost from the most recent accepted/effective
 * financial term in the negotiation ledger.
 *
 * Only `financialTruth === true` line items with category === 'procedure'
 * and a positive amount are used. Returns null if no such term exists.
 */
function deriveAcceptedUnitCostFromLedger(
  summary: StudyBudgetEvidenceSummary,
): number | null {
  for (const entry of summary.negotiationLedger) {
    const procedureItems = entry.lineItems.filter(
      (item) =>
        item.financialTruth === true &&
        item.category === 'procedure' &&
        typeof item.amount === 'number' &&
        item.amount > 0,
    )
    if (procedureItems.length > 0) {
      // Sum the accepted procedure line items from the most recent event
      const total = procedureItems.reduce(
        (sum, item) => sum + (item.amount as number),
        0,
      )
      return roundMoney(total)
    }
  }
  return null
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute the Revenue Protection pipeline for a study.
 *
 * @param summary  - The study budget evidence summary (from negotiation ledger).
 * @param executionData - Optional execution data from `loadStudyFinancialRuntimeSummary`.
 *                        If null/undefined, executed_work_count and earned_revenue are null.
 * @param invoiceSummary - Optional study-level invoice/payment aggregation from
 *                         `loadStudyInvoiceSummary`. If null/undefined, invoiced_amount
 *                         and paid_amount remain null (pre-6B.2 behavior preserved).
 *
 * @returns RevenueProtectionSummary with null for any stage lacking real data.
 */
export function computeRevenueProtection(
  summary: StudyBudgetEvidenceSummary,
  executionData?: StudyFinancialRuntimeSummary | StudyExecutionData | null,
  invoiceSummary?: StudyInvoiceSummary | null,
): RevenueProtectionSummary {
  // ── Step 1: Derive accepted unit cost from negotiation ledger ──────────────
  const acceptedUnitCost = deriveAcceptedUnitCostFromLedger(summary)

  // ── Step 2: Extract procedure counts from execution data ───────────────────
  const expectedProcedureCount: number | null =
    executionData?.expectedProcedureCount ?? null

  const executedProcedureCount: number | null =
    executionData?.executedProcedureCount ?? null

  const earnedProcedureCount: number | null =
    executionData?.earnedProcedureCount ?? null

  // ── Step 3: Compute Expected Revenue ─────────────────────────────────────
  // Requires: accepted unit cost AND expected procedure count from runtime
  const expected_revenue: number | null =
    acceptedUnitCost !== null && expectedProcedureCount !== null
      ? roundMoney(acceptedUnitCost * expectedProcedureCount)
      : null

  // ── Step 4: Executed work count ───────────────────────────────────────────
  // Raw quantity only — not a dollar amount
  const executed_work_count: number | null = executedProcedureCount

  // ── Step 5: Compute Earned Revenue ────────────────────────────────────────
  // Requires: accepted unit cost AND earned procedure count
  const earned_revenue: number | null =
    acceptedUnitCost !== null && earnedProcedureCount !== null
      ? roundMoney(acceptedUnitCost * earnedProcedureCount)
      : null

  // ── Step 6: Invoiced / Paid ───────────────────────────────────────────────
  // Populated from the study-level invoice/payment aggregation provided by
  // `loadStudyInvoiceSummary`. Falls back to null when no aggregation is wired.
  const invoiced_amount: number | null = invoiceSummary?.invoicedAmount ?? null
  const paid_amount: number | null = invoiceSummary?.paidAmount ?? null

  // ── Step 7: Compute leakage ───────────────────────────────────────────────
  const expected_vs_earned: number | null =
    expected_revenue !== null && earned_revenue !== null
      ? roundMoney(expected_revenue - earned_revenue)
      : null

  const earned_vs_invoiced: number | null =
    earned_revenue !== null && invoiced_amount !== null
      ? roundMoney(earned_revenue - invoiced_amount)
      : null

  const invoiced_vs_paid: number | null =
    invoiced_amount !== null && paid_amount !== null
      ? roundMoney(invoiced_amount - paid_amount)
      : null

  return {
    expected_revenue,
    executed_work_count,
    earned_revenue,
    invoiced_amount,
    paid_amount,
    leakage: {
      expected_vs_earned,
      earned_vs_invoiced,
      invoiced_vs_paid,
    },
  }
}
