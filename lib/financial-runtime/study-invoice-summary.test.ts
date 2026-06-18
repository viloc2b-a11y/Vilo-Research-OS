import { describe, expect, it } from 'vitest'
import { loadStudyInvoiceSummary } from './study-invoice-summary'

// ── Supabase mock helpers ─────────────────────────────────────────────────────

type MockRow = Record<string, unknown>

/**
 * Builds a minimal chainable Supabase query stub for a single table.
 * Supports: .select() .eq() .not() — returns the provided rows on resolution.
 */
function buildQueryStub(rows: MockRow[]) {
  let filteredRows = [...rows]

  const stub = {
    select: (_columns?: string) => stub,
    eq: (_column: string, value: unknown) => {
      filteredRows = filteredRows.filter((row) => row[_column] === value)
      return stub
    },
    not: (_column: string, _op: string, value: unknown) => {
      filteredRows = filteredRows.filter((row) => row[_column] !== value)
      return stub
    },
    then: (resolve: (result: { data: MockRow[]; error: null }) => void) => {
      resolve({ data: filteredRows, error: null })
    },
  }

  // Make it thenable so `await supabase.from(...).select(...).eq(...).not(...)` resolves
  Object.defineProperty(stub, Symbol.toStringTag, { value: 'Promise' })
  return Object.assign(
    Object.create(null),
    stub,
    {
      [Symbol.iterator]: undefined,
    },
  )
}

/**
 * Builds a minimal Supabase client stub that handles invoice and payment queries.
 */
function buildSupabaseStub(options: {
  invoices?: MockRow[]
  payments?: MockRow[]
}) {
  const invoices = options.invoices ?? []
  const payments = options.payments ?? []

  return {
    from: (table: string) => {
      if (table === 'financial_invoices') return buildQueryStub(invoices)
      if (table === 'financial_payments') return buildQueryStub(payments)
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STUDY_ID = 'study-aaa'
const OTHER_STUDY_ID = 'study-bbb'

function buildInvoice(overrides: MockRow = {}): MockRow {
  return {
    id: 'invoice-1',
    total_amount: 1000,
    invoice_date: '2026-05-01T00:00:00.000Z',
    invoice_status: 'sent',
    study_id: STUDY_ID,
    ...overrides,
  }
}

function buildPayment(overrides: MockRow = {}): MockRow {
  return {
    id: 'payment-1',
    amount_applied: 800,
    received_at: '2026-05-10T00:00:00.000Z',
    payment_status: 'posted',
    study_id: STUDY_ID,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadStudyInvoiceSummary', () => {
  it('returns correct invoicedAmount and paidAmount when invoices and payments exist', async () => {
    const supabase = buildSupabaseStub({
      invoices: [
        buildInvoice({ id: 'inv-1', total_amount: 3000 }),
        buildInvoice({ id: 'inv-2', total_amount: 2000, invoice_date: '2026-06-01T00:00:00.000Z' }),
      ],
      payments: [
        buildPayment({ id: 'pay-1', amount_applied: 1500 }),
        buildPayment({ id: 'pay-2', amount_applied: 1000, received_at: '2026-06-05T00:00:00.000Z' }),
      ],
    })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    expect(result.invoicedAmount).toBe(5000)
    expect(result.paidAmount).toBe(2500)
    expect(result.invoiceCount).toBe(2)
    expect(result.paymentCount).toBe(2)
    expect(result.latestInvoiceDate).toBe('2026-06-01T00:00:00.000Z')
    expect(result.latestPaymentDate).toBe('2026-06-05T00:00:00.000Z')
  })

  it('returns invoicedAmount: null when no invoices exist', async () => {
    const supabase = buildSupabaseStub({ invoices: [], payments: [] })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    // null, not 0 — no fabrication
    expect(result.invoicedAmount).toBeNull()
    expect(result.paidAmount).toBeNull()
    expect(result.invoiceCount).toBe(0)
    expect(result.paymentCount).toBe(0)
    expect(result.latestInvoiceDate).toBeNull()
    expect(result.latestPaymentDate).toBeNull()
  })

  it('returns paidAmount: null when invoices exist but no payments', async () => {
    const supabase = buildSupabaseStub({
      invoices: [buildInvoice({ total_amount: 2000 })],
      payments: [],
    })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    expect(result.invoicedAmount).toBe(2000)
    // null, not 0 — no payments recorded yet
    expect(result.paidAmount).toBeNull()
    expect(result.invoiceCount).toBe(1)
    expect(result.paymentCount).toBe(0)
  })

  it('returns invoiceCount: 0 and paymentCount: 0 when no invoices', async () => {
    const supabase = buildSupabaseStub({ invoices: [], payments: [] })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    // counts are 0 when absent (0 is semantically correct for counts)
    expect(result.invoiceCount).toBe(0)
    expect(result.paymentCount).toBe(0)
  })

  it('returns empty result when studyId matches no invoices', async () => {
    // Invoices and payments exist for a different study
    const supabase = buildSupabaseStub({
      invoices: [buildInvoice({ study_id: OTHER_STUDY_ID })],
      payments: [buildPayment({ study_id: OTHER_STUDY_ID })],
    })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    expect(result.invoicedAmount).toBeNull()
    expect(result.paidAmount).toBeNull()
    expect(result.invoiceCount).toBe(0)
    expect(result.paymentCount).toBe(0)
  })

  it('excludes void invoices from invoicedAmount', async () => {
    // The mock stub filters by .not('invoice_status', 'eq', 'void')
    // so void invoices should be excluded
    const supabase = buildSupabaseStub({
      invoices: [
        buildInvoice({ id: 'inv-1', total_amount: 1000, invoice_status: 'sent' }),
        buildInvoice({ id: 'inv-2', total_amount: 500, invoice_status: 'void' }),
      ],
      payments: [],
    })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    // Only the sent invoice should be included
    expect(result.invoicedAmount).toBe(1000)
    expect(result.invoiceCount).toBe(1)
  })

  it('excludes reversed payments from paidAmount', async () => {
    const supabase = buildSupabaseStub({
      invoices: [buildInvoice({ total_amount: 1000 })],
      payments: [
        buildPayment({ id: 'pay-1', amount_applied: 800, payment_status: 'posted' }),
        buildPayment({ id: 'pay-2', amount_applied: 800, payment_status: 'reversed' }),
      ],
    })

    const result = await loadStudyInvoiceSummary(supabase as never, STUDY_ID)

    // Only the posted payment should be included
    expect(result.paidAmount).toBe(800)
    expect(result.paymentCount).toBe(1)
  })
})
