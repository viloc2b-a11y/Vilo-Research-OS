import type { SupabaseClient } from '@supabase/supabase-js'
import { computeVisitFinancialRuntime } from '@/lib/financial-runtime/compute-visit'
import type { VisitFinancialRuntime } from '@/lib/financial-runtime/types'

export type FinancialInvoiceableLineItem = {
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
  invoice_status: 'invoiceable'
  source_state: 'earned'
  source_financial_version: number
  source_computed_at: string
  earned_at: string
}

export type MaterializeInvoiceableLineItemsResult = {
  visitId: string
  invoiceableCount: number
  pricingEventId: string | null
  unitCost: number | null
}

type NegotiationLineItem = {
  category?: string | null
  amount?: number | string | null
}

type BudgetNegotiationPricingEventType =
  | 'sponsor_offer_received'
  | 'counteroffer_sent'
  | 'term_accepted'
  | 'term_adjusted'

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function parseNegotiationLineItems(eventPayload: Record<string, unknown> | null | undefined): NegotiationLineItem[] {
  const raw = eventPayload?.line_items
  if (!Array.isArray(raw)) return []

  return raw
    .map((item): NegotiationLineItem | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      const amount =
        typeof record.amount === 'number' && Number.isFinite(record.amount)
          ? record.amount
          : typeof record.amount === 'string' && Number.isFinite(Number(record.amount))
            ? Number(record.amount)
            : null
      return {
        category: typeof record.category === 'string' ? record.category : null,
        amount,
      }
    })
    .filter((item): item is NegotiationLineItem => item !== null)
}

function isEffectivePricingEvent(input: {
  eventType: BudgetNegotiationPricingEventType | string
  eventPayload: Record<string, unknown>
}) {
  if (input.eventType === 'term_accepted') return true
  if (input.eventType !== 'term_adjusted') return false

  return (
    input.eventPayload.approved_for_pricing === true ||
    input.eventPayload.pricing_effective === true ||
    input.eventPayload.effective_financial_term === true
  )
}

export async function resolveProcedurePricing(input: {
  supabase: SupabaseClient
  studyId: string
  earnedBillableCount: number
}): Promise<{ pricingEventId: string | null; unitCost: number | null }> {
  const { data, error } = await input.supabase
    .from('study_budget_negotiation_events')
    .select('id, event_type, event_payload, created_at')
    .eq('study_id', input.studyId)
    .in('event_type', ['term_accepted', 'term_adjusted'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new Error(`Failed to load budget negotiation events: ${error.message}`)
  }

  for (const row of data ?? []) {
    const pricingEventId = String(row.id)
    const eventPayload = (row.event_payload ?? {}) as Record<string, unknown>
    if (
      !isEffectivePricingEvent({
        eventType: String(row.event_type),
        eventPayload,
      })
    ) {
      continue
    }

    const lineItems = parseNegotiationLineItems(eventPayload)
    const procedureTotal = lineItems
      .filter((item) => item.category === 'procedure')
      .reduce((sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0), 0)

    if (procedureTotal > 0) {
      const denominator = Math.max(1, input.earnedBillableCount)
      return {
        pricingEventId,
        unitCost: roundMoney(procedureTotal / denominator),
      }
    }
  }

  return { pricingEventId: null, unitCost: null }
}

export function buildInvoiceableLineItems(input: {
  financial: VisitFinancialRuntime
  visitName: string
  billableTo?: string
  unitCost: number
  pricingEventId?: string | null
}): FinancialInvoiceableLineItem[] {
  const billableTo = input.billableTo ?? 'sponsor'
  const unitCost = roundMoney(input.unitCost)
  const amount = roundMoney(unitCost)

  return input.financial.paymentLifecycle.components
    .filter((component) => component.componentType === 'procedure_payment' && component.lifecycleStatus === 'earned' && component.eligible)
    .map((component) => {
      return {
        organization_id: input.financial.organizationId,
        study_id: input.financial.studyId,
        study_subject_id: input.financial.studySubjectId,
        visit_id: input.financial.visitId,
        procedure_execution_id: component.procedureExecutionId ?? component.id.replace('procedure-payment:', ''),
        pricing_event_id: input.pricingEventId ?? null,
        visit_name: input.visitName,
        activity_id: component.procedureExecutionId ?? component.id,
        activity_type: 'procedure_payment' as const,
        description: component.label,
        billable_to: billableTo,
        quantity: component.quantity,
        unit_cost: unitCost,
        amount,
        currency: 'USD',
        invoice_status: 'invoiceable',
        source_state: 'earned',
        source_financial_version: input.financial.financialVersion,
        source_computed_at: input.financial.computedAt,
        earned_at: input.financial.computedAt,
      }
    })
}

export async function materializeInvoiceableLineItemsForVisit(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<MaterializeInvoiceableLineItemsResult> {
  const financial = await computeVisitFinancialRuntime({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
  })

  if (!financial) {
    return {
      visitId: input.visitId,
      invoiceableCount: 0,
      pricingEventId: null,
      unitCost: null,
    }
  }

  const { data: visit, error: visitError } = await input.supabase
    .from('visits')
    .select('id, visit_definition_id, visit_definitions(code, label)')
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (visitError) {
    throw new Error(`Failed to load visit metadata: ${visitError.message}`)
  }

  const visitDefinition = Array.isArray(visit?.visit_definitions)
    ? (visit.visit_definitions[0] as { code?: string; label?: string } | undefined)
    : (visit?.visit_definitions as { code?: string; label?: string } | null | undefined)
  const visitName = visitDefinition?.label ?? visitDefinition?.code ?? input.visitId

  const earnedBillableCount = financial.paymentLifecycle.components.filter(
    (component) => component.componentType === 'procedure_payment' && component.lifecycleStatus === 'earned' && component.eligible,
  ).length

  if (earnedBillableCount === 0) {
    return {
      visitId: input.visitId,
      invoiceableCount: 0,
      pricingEventId: null,
      unitCost: null,
    }
  }

  const pricing = await resolveProcedurePricing({
    supabase: input.supabase,
    studyId: input.studyId,
    earnedBillableCount: financial.expected.billableProcedureCount || earnedBillableCount,
  })

  if (pricing.unitCost === null) {
    return {
      visitId: input.visitId,
      invoiceableCount: 0,
      pricingEventId: pricing.pricingEventId,
      unitCost: null,
    }
  }

  const rows = buildInvoiceableLineItems({
    financial,
    visitName,
    unitCost: pricing.unitCost,
    pricingEventId: pricing.pricingEventId,
  })

  if (rows.length === 0) {
    return {
      visitId: input.visitId,
      invoiceableCount: 0,
      pricingEventId: pricing.pricingEventId,
      unitCost: pricing.unitCost,
    }
  }

  const { error } = await input.supabase
    .from('financial_invoiceable_line_items')
    .upsert(rows, { onConflict: 'visit_id,procedure_execution_id' })

  if (error) {
    throw new Error(`Failed to materialize invoiceable line items: ${error.message}`)
  }

  return {
    visitId: input.visitId,
    invoiceableCount: rows.length,
    pricingEventId: pricing.pricingEventId,
    unitCost: pricing.unitCost,
  }
}
