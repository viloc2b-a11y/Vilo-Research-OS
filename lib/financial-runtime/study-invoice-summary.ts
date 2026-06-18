/**
 * Study-level invoice and payment aggregation.
 *
 * Loads and rolls up `financial_invoices` and `financial_payments` for a single
 * study into scalar totals that can be fed to `computeRevenueProtection()`.
 *
 * Rules:
 * - invoicedAmount: sum of `total_amount` across non-void invoices; null if no invoices
 * - paidAmount: sum of `amount_applied` across non-reversed payments; null if no payments
 * - Counts are 0-based (0 is semantically correct when there are none)
 * - No fabrication: if rows are absent, the corresponding amount is null, not 0
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type StudyInvoiceSummary = {
  /** Sum of `total_amount` across non-void invoices for this study; null if no invoices */
  invoicedAmount: number | null
  /** Sum of `amount_applied` across non-reversed payments for this study's invoices; null if no payments */
  paidAmount: number | null
  /** Count of non-void invoices for this study; 0 if none */
  invoiceCount: number
  /** Count of non-reversed payments for this study's invoices; 0 if none */
  paymentCount: number
  /** ISO timestamp of the most recent non-void invoice_date; null if no invoices */
  latestInvoiceDate: string | null
  /** ISO timestamp of the most recent non-reversed received_at; null if no payments */
  latestPaymentDate: string | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export async function loadStudyInvoiceSummary(
  supabase: SupabaseClient,
  studyId: string,
): Promise<StudyInvoiceSummary> {
  // ── Step 1: Load non-void invoices for this study ─────────────────────────
  // financial_invoices has a direct study_id column — no join needed
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from('financial_invoices')
    .select('id, total_amount, invoice_date')
    .eq('study_id', studyId)
    .not('invoice_status', 'eq', 'void')

  if (invoiceError) {
    throw new Error(`Failed to load study invoices: ${invoiceError.message}`)
  }

  const invoices = invoiceRows ?? []

  if (invoices.length === 0) {
    return {
      invoicedAmount: null,
      paidAmount: null,
      invoiceCount: 0,
      paymentCount: 0,
      latestInvoiceDate: null,
      latestPaymentDate: null,
    }
  }

  // ── Step 2: Sum invoice totals ────────────────────────────────────────────
  const invoiceCount = invoices.length
  const invoicedAmount = roundMoney(
    invoices.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
  )
  const latestInvoiceDate =
    invoices
      .map((row) => String(row.invoice_date))
      .sort()
      .reverse()[0] ?? null

  // ── Step 3: Load non-reversed payments for this study ─────────────────────
  // financial_payments has a direct study_id column as well
  const { data: paymentRows, error: paymentError } = await supabase
    .from('financial_payments')
    .select('id, amount_applied, received_at')
    .eq('study_id', studyId)
    .not('payment_status', 'eq', 'reversed')

  if (paymentError) {
    throw new Error(`Failed to load study payments: ${paymentError.message}`)
  }

  const payments = paymentRows ?? []

  if (payments.length === 0) {
    return {
      invoicedAmount,
      paidAmount: null,
      invoiceCount,
      paymentCount: 0,
      latestInvoiceDate,
      latestPaymentDate: null,
    }
  }

  // ── Step 4: Sum payment amounts ───────────────────────────────────────────
  const paymentCount = payments.length
  const paidAmount = roundMoney(
    payments.reduce((sum, row) => sum + Number(row.amount_applied ?? 0), 0),
  )
  const latestPaymentDate =
    payments
      .map((row) => String(row.received_at))
      .sort()
      .reverse()[0] ?? null

  return {
    invoicedAmount,
    paidAmount,
    invoiceCount,
    paymentCount,
    latestInvoiceDate,
    latestPaymentDate,
  }
}
