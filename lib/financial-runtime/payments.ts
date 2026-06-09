import type { SupabaseClient } from '@supabase/supabase-js'

export type FinancialPaymentStatus = 'posted' | 'reversed' | 'disputed'
export type FinancialInvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overpaid' | 'disputed'

export type FinancialPaymentRecord = {
  id: string
  payment_reference: string
  organization_id: string
  study_id: string
  study_subject_id: string
  visit_id: string
  invoice_id: string
  pricing_event_id: string | null
  currency: string
  payment_method: string
  payment_status: FinancialPaymentStatus
  amount_received: number
  amount_applied: number
  amount_unapplied: number
  received_at: string
  posted_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type RecordPaymentResult = {
  paymentId: string | null
  paymentReference: string | null
  invoiceId: string | null
  invoiceStatus: FinancialInvoicePaymentStatus | null
  amountReceived: number
  amountApplied: number
  amountUnapplied: number
  paymentCount: number
  idempotent: boolean
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function buildDefaultPaymentReference(invoiceId: string, receivedAt: string): string {
  const stamp = receivedAt.replace(/[^0-9]/g, '').slice(0, 14)
  return `PAY-${invoiceId.replace(/-/g, '').slice(0, 12).toUpperCase()}-${stamp || 'NOW'}`
}

async function loadInvoiceState(input: {
  supabase: SupabaseClient
  invoiceId: string
}) {
  const { data, error } = await input.supabase
    .from('financial_invoices')
    .select('id, invoice_number, organization_id, study_id, study_subject_id, visit_id, pricing_event_id, invoice_status, payment_status, total_amount, amount_paid, balance_due, source_financial_version, source_computed_at')
    .eq('id', input.invoiceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load invoice state: ${error.message}`)
  }

  return data as
    | {
        id: string
        invoice_number: string
        organization_id: string
        study_id: string
        study_subject_id: string
        visit_id: string
        pricing_event_id: string | null
        invoice_status: string
        payment_status: FinancialInvoicePaymentStatus
        total_amount: number
        amount_paid: number
        balance_due: number
        source_financial_version: number
        source_computed_at: string
      }
    | null
}

async function loadInvoiceLineItems(input: {
  supabase: SupabaseClient
  invoiceId: string
}) {
  const { data, error } = await input.supabase
    .from('financial_invoice_line_items')
    .select('id, amount, invoice_id, invoiceable_line_item_id')
    .eq('invoice_id', input.invoiceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load invoice line items: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    amount: roundMoney(Number(row.amount)),
    invoice_id: String(row.invoice_id),
    invoiceable_line_item_id: String(row.invoiceable_line_item_id),
  }))
}

function nextPaymentStatus(totalAmount: number, amountPaid: number): FinancialInvoicePaymentStatus {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid < totalAmount) return 'partially_paid'
  if (amountPaid === totalAmount) return 'paid'
  return 'overpaid'
}

export async function recordInvoicePayment(input: {
  supabase: SupabaseClient
  invoiceId: string
  amountReceived: number
  paymentReference?: string
  paymentMethod?: string
  notes?: string | null
}): Promise<RecordPaymentResult> {
  const invoice = await loadInvoiceState({ supabase: input.supabase, invoiceId: input.invoiceId })
  if (!invoice) {
    return {
      paymentId: null,
      paymentReference: null,
      invoiceId: null,
      invoiceStatus: null,
      amountReceived: 0,
      amountApplied: 0,
      amountUnapplied: 0,
      paymentCount: 0,
      idempotent: false,
    }
  }

  const receivedAt = new Date().toISOString()
  const paymentReference = input.paymentReference ?? buildDefaultPaymentReference(invoice.id, receivedAt)
  const amountReceived = roundMoney(input.amountReceived)

  const { data: existingPayment, error: existingPaymentError } = await input.supabase
    .from('financial_payments')
    .select('id, payment_reference, amount_received, amount_applied, amount_unapplied')
    .eq('payment_reference', paymentReference)
    .maybeSingle()

  if (existingPaymentError) {
    throw new Error(`Failed to load payment ledger state: ${existingPaymentError.message}`)
  }

  if (existingPayment) {
    return {
      paymentId: String(existingPayment.id),
      paymentReference: String(existingPayment.payment_reference),
      invoiceId: invoice.id,
      invoiceStatus: invoice.payment_status,
      amountReceived: Number(existingPayment.amount_received),
      amountApplied: Number(existingPayment.amount_applied),
      amountUnapplied: Number(existingPayment.amount_unapplied),
      paymentCount: 1,
      idempotent: true,
    }
  }

  const outstanding = roundMoney(Math.max(0, Number(invoice.total_amount ?? 0) - Number(invoice.amount_paid ?? 0)))
  const amountApplied = roundMoney(Math.min(amountReceived, outstanding))
  const amountUnapplied = roundMoney(Math.max(0, amountReceived - amountApplied))

  const { data: paymentRow, error: paymentError } = await input.supabase
    .from('financial_payments')
    .insert({
      payment_reference: paymentReference,
      organization_id: invoice.organization_id,
      study_id: invoice.study_id,
      study_subject_id: invoice.study_subject_id,
      visit_id: invoice.visit_id,
      invoice_id: invoice.id,
      pricing_event_id: invoice.pricing_event_id,
      currency: 'USD',
      payment_method: input.paymentMethod ?? 'ach',
      payment_status: 'posted',
      amount_received: amountReceived,
      amount_applied: amountApplied,
      amount_unapplied: amountUnapplied,
      received_at: receivedAt,
      posted_at: receivedAt,
      notes: input.notes ?? null,
    })
    .select('id, payment_reference')
    .single()

  if (paymentError || !paymentRow) {
    throw new Error(`Failed to record payment: ${paymentError?.message ?? 'unknown error'}`)
  }

  const lineItems = await loadInvoiceLineItems({ supabase: input.supabase, invoiceId: invoice.id })
  let remainingToApply = amountApplied
  const allocations: Array<{
    payment_id: string
    invoice_id: string
    invoice_line_item_id: string
    organization_id: string
    study_id: string
    visit_id: string
    amount_allocated: number
    allocation_status: 'applied'
  }> = []

  for (const line of lineItems) {
    if (remainingToApply <= 0) break
    const applied = roundMoney(Math.min(remainingToApply, line.amount))
    if (applied <= 0) continue
    allocations.push({
      payment_id: String(paymentRow.id),
      invoice_id: invoice.id,
      invoice_line_item_id: line.id,
      organization_id: invoice.organization_id,
      study_id: invoice.study_id,
      visit_id: invoice.visit_id,
      amount_allocated: applied,
      allocation_status: 'applied',
    })
    remainingToApply = roundMoney(remainingToApply - applied)
  }

  if (allocations.length > 0) {
    const { error: allocationError } = await input.supabase
      .from('financial_payment_allocations')
      .upsert(allocations, { onConflict: 'payment_id,invoice_line_item_id' })

    if (allocationError) {
      throw new Error(`Failed to create payment allocations: ${allocationError.message}`)
    }
  }

  const newAmountPaid = roundMoney(Number(invoice.amount_paid ?? 0) + amountApplied)
  const newBalanceDue = roundMoney(Math.max(0, Number(invoice.total_amount ?? 0) - newAmountPaid))
  const paymentStatus = nextPaymentStatus(Number(invoice.total_amount ?? 0), newAmountPaid)
  const isSettled = paymentStatus === 'paid' || paymentStatus === 'overpaid'

  const { error: invoiceUpdateError } = await input.supabase
    .from('financial_invoices')
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      payment_status: paymentStatus,
      paid_at: isSettled ? receivedAt : null,
    })
    .eq('id', invoice.id)

  if (invoiceUpdateError) {
    throw new Error(`Failed to update invoice payment status: ${invoiceUpdateError.message}`)
  }

  if (isSettled && lineItems.length > 0) {
    const { error: lineUpdateError } = await input.supabase
      .from('financial_invoiceable_line_items')
      .update({ invoice_status: 'paid' })
      .in(
        'id',
        lineItems.map((line) => line.invoiceable_line_item_id),
      )

    if (lineUpdateError) {
      throw new Error(`Failed to update invoiceable payment status: ${lineUpdateError.message}`)
    }
  }

  return {
    paymentId: String(paymentRow.id),
    paymentReference: String(paymentRow.payment_reference),
    invoiceId: invoice.id,
    invoiceStatus: paymentStatus,
    amountReceived,
    amountApplied,
    amountUnapplied,
    paymentCount: 1,
    idempotent: false,
  }
}
