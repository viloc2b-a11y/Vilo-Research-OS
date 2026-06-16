import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialInvoiceableLineItem } from '@/lib/financial-runtime/invoiceable'
import { logAuditEvent } from '@/lib/audit/log'

export type FinancialInvoiceRecord = {
  id: string
  invoice_number: string
  organization_id: string
  study_id: string
  study_subject_id: string
  visit_id: string
  pricing_event_id: string | null
  currency: string
  invoice_status: 'draft' | 'sent' | 'void'
  invoice_date: string
  sent_at: string | null
  total_amount: number
  source_financial_version: number
  source_computed_at: string
  created_at: string
  updated_at: string
}

export type FinancialInvoiceLineItemRecord = {
  invoice_id: string
  invoiceable_line_item_id: string
  organization_id: string
  study_id: string
  study_subject_id: string
  visit_id: string
  procedure_execution_id: string
  pricing_event_id: string | null
  visit_name: string
  activity_id: string
  activity_type: 'procedure_payment'
  description: string
  billable_to: string
  quantity: number
  unit_cost: number
  amount: number
  currency: 'USD'
  line_status: 'draft' | 'sent' | 'void'
  source_state: 'earned'
}

export type FinancialInvoiceDraftResult = {
  invoiceId: string | null
  invoiceNumber: string | null
  lineItemCount: number
  totalAmount: number
  invoiceStatus: 'draft' | 'sent' | 'void' | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function buildInvoiceNumber(visitId: string): string {
  return `INV-${visitId.replace(/-/g, '').slice(0, 12).toUpperCase()}`
}

function sumInvoiceableAmounts(items: FinancialInvoiceableLineItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + item.amount, 0))
}

async function loadInvoiceableItemsForVisit(
  supabase: SupabaseClient,
  visitId: string,
): Promise<(FinancialInvoiceableLineItem & { id: string })[]> {
  const { data, error } = await supabase
    .from('financial_invoiceable_line_items')
    .select('*')
    .eq('visit_id', visitId)
    .in('invoice_status', ['invoiceable', 'draft'])
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load invoiceable line items: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organization_id: String(row.organization_id),
    study_id: String(row.study_id),
    study_subject_id: String(row.study_subject_id),
    visit_id: String(row.visit_id),
    procedure_execution_id: String(row.procedure_execution_id),
    pricing_event_id: row.pricing_event_id ? String(row.pricing_event_id) : null,
    visit_name: String(row.visit_name),
    activity_id: String(row.activity_id),
    activity_type: 'procedure_payment',
    description: String(row.description),
    billable_to: String(row.billable_to),
    quantity: Number(row.quantity),
    unit_cost: Number(row.unit_cost),
    amount: Number(row.amount),
    currency: 'USD',
    invoice_status: 'invoiceable',
    source_state: 'earned',
    source_financial_version: Number(row.source_financial_version),
    source_computed_at: String(row.source_computed_at),
    earned_at: String(row.earned_at),
  }))
}

export async function createInvoiceDraftForVisit(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  actorUserId?: string
}): Promise<FinancialInvoiceDraftResult> {
  const { data: existingInvoice, error: existingError } = await input.supabase
    .from('financial_invoices')
    .select('id, invoice_number, invoice_status, total_amount')
    .eq('visit_id', input.visitId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load invoice queue state: ${existingError.message}`)
  }

  if (existingInvoice?.invoice_status === 'sent' || existingInvoice?.invoice_status === 'void') {
    const { count } = await input.supabase
      .from('financial_invoice_line_items')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', existingInvoice.id)

    return {
      invoiceId: String(existingInvoice.id),
      invoiceNumber: String(existingInvoice.invoice_number),
      lineItemCount: count ?? 0,
      totalAmount: Number(existingInvoice.total_amount ?? 0),
      invoiceStatus: existingInvoice.invoice_status,
    }
  }

  const items = await loadInvoiceableItemsForVisit(input.supabase, input.visitId)
  if (items.length === 0) {
    return {
      invoiceId: null,
      invoiceNumber: null,
      lineItemCount: 0,
      totalAmount: 0,
      invoiceStatus: null,
    }
  }

  const totalAmount = sumInvoiceableAmounts(items)
  const invoiceNumber = buildInvoiceNumber(input.visitId)
  const sourceFinancialVersion = Math.max(...items.map((item) => item.source_financial_version))
  const sourceComputedAt = items[0]?.source_computed_at ?? new Date().toISOString()
  const pricingEventId = items.find((item) => item.pricing_event_id)?.pricing_event_id ?? null

  const { data: invoiceRow, error: invoiceError } = await input.supabase
    .from('financial_invoices')
    .upsert(
      {
        invoice_number: invoiceNumber,
        organization_id: input.organizationId,
        study_id: input.studyId,
        study_subject_id: items[0]!.study_subject_id,
        visit_id: input.visitId,
        pricing_event_id: pricingEventId,
        currency: 'USD',
        invoice_status: 'draft',
        invoice_date: new Date().toISOString(),
        sent_at: null,
        total_amount: totalAmount,
        source_financial_version: sourceFinancialVersion,
        source_computed_at: sourceComputedAt,
      },
      { onConflict: 'visit_id' },
    )
    .select('id, invoice_number, invoice_status')
    .single()

  if (invoiceError || !invoiceRow) {
    throw new Error(`Failed to create invoice draft: ${invoiceError?.message ?? 'unknown error'}`)
  }

  const invoice = invoiceRow as Pick<FinancialInvoiceRecord, 'id' | 'invoice_number' | 'invoice_status'>

  const lineItems: FinancialInvoiceLineItemRecord[] = items.map((item) => ({
    invoice_id: invoice.id,
    invoiceable_line_item_id: item.id,
    organization_id: item.organization_id,
    study_id: item.study_id,
    study_subject_id: item.study_subject_id,
    visit_id: item.visit_id,
    procedure_execution_id: item.procedure_execution_id,
    pricing_event_id: item.pricing_event_id,
    visit_name: item.visit_name,
    activity_id: item.activity_id,
    activity_type: 'procedure_payment',
    description: item.description,
    billable_to: item.billable_to,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
    amount: item.amount,
    currency: 'USD',
    line_status: 'draft',
    source_state: 'earned',
  }))

  const { error: lineError } = await input.supabase
    .from('financial_invoice_line_items')
    .upsert(lineItems, { onConflict: 'invoice_id,invoiceable_line_item_id' })

  if (lineError) {
    throw new Error(`Failed to create invoice draft line items: ${lineError.message}`)
  }

  const { error: sourceError } = await input.supabase
    .from('financial_invoiceable_line_items')
    .update({ invoice_status: 'draft' })
    .eq('visit_id', input.visitId)
    .in('id', items.map((item) => item.id))

  if (sourceError) {
    throw new Error(`Failed to mark invoiceable items as draft: ${sourceError.message}`)
  }

  if (input.actorUserId) {
    logAuditEvent({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'financial:invoice_draft_created',
      target: `invoice:${invoice.id}`,
      metadata: { visitId: input.visitId, studyId: input.studyId, lineItemCount: lineItems.length, totalAmount },
    }).catch(() => undefined)
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    lineItemCount: lineItems.length,
    totalAmount,
    invoiceStatus: invoice.invoice_status,
  }
}

export async function sendInvoiceDraftForVisit(input: {
  supabase: SupabaseClient
  visitId: string
  organizationId?: string
  actorUserId?: string
}): Promise<FinancialInvoiceDraftResult> {
  const { data: invoiceRow, error: invoiceError } = await input.supabase
    .from('financial_invoices')
    .select('id, invoice_number, invoice_status, total_amount')
    .eq('visit_id', input.visitId)
    .maybeSingle()

  if (invoiceError) {
    throw new Error(`Failed to load invoice draft: ${invoiceError.message}`)
  }

  if (!invoiceRow) {
    return {
      invoiceId: null,
      invoiceNumber: null,
      lineItemCount: 0,
      totalAmount: 0,
      invoiceStatus: null,
    }
  }

  if (invoiceRow.invoice_status === 'sent') {
    const { count } = await input.supabase
      .from('financial_invoice_line_items')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', invoiceRow.id)

    return {
      invoiceId: invoiceRow.id,
      invoiceNumber: invoiceRow.invoice_number,
      lineItemCount: count ?? 0,
      totalAmount: Number(invoiceRow.total_amount ?? 0),
      invoiceStatus: 'sent',
    }
  }

  const { data: lineItems, error: lineError } = await input.supabase
    .from('financial_invoice_line_items')
    .select('id, amount, invoiceable_line_item_id')
    .eq('invoice_id', invoiceRow.id)

  if (lineError) {
    throw new Error(`Failed to load invoice draft line items: ${lineError.message}`)
  }

  const totalAmount = roundMoney(
    (lineItems ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
  )
  const { error: updateInvoiceError } = await input.supabase
    .from('financial_invoices')
    .update({
      invoice_status: 'sent',
      sent_at: new Date().toISOString(),
      total_amount: totalAmount,
    })
    .eq('id', invoiceRow.id)

  if (updateInvoiceError) {
    throw new Error(`Failed to send invoice draft: ${updateInvoiceError.message}`)
  }

  if ((lineItems ?? []).length > 0) {
    const { error: updateLineError } = await input.supabase
      .from('financial_invoice_line_items')
      .update({ line_status: 'sent' })
      .eq('invoice_id', invoiceRow.id)

    if (updateLineError) {
      throw new Error(`Failed to mark invoice line items sent: ${updateLineError.message}`)
    }

    const { error: sourceError } = await input.supabase
      .from('financial_invoiceable_line_items')
      .update({ invoice_status: 'sent' })
      .in(
        'id',
        (lineItems ?? []).map((row) => String(row.invoiceable_line_item_id)),
      )

    if (sourceError) {
      throw new Error(`Failed to mark invoiceable items sent: ${sourceError.message}`)
    }
  }

  if (input.actorUserId && input.organizationId) {
    logAuditEvent({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'financial:invoice_sent',
      target: `invoice:${invoiceRow.id}`,
      metadata: { visitId: input.visitId, totalAmount, lineItemCount: lineItems?.length ?? 0 },
    }).catch(() => undefined)
  }

  return {
    invoiceId: invoiceRow.id,
    invoiceNumber: invoiceRow.invoice_number,
    lineItemCount: lineItems?.length ?? 0,
    totalAmount,
    invoiceStatus: 'sent',
  }
}
