'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { recordInvoicePayment } from '@/lib/financial-runtime/payments'
import { coordinatorMessageFromError } from '@/lib/runtime-errors'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

export async function recordInvoicePaymentAction(input: {
  invoiceId: string
  amountReceived: number
  visitPath: string
  studyPath: string
  subjectPath: string
  paymentReference?: string
  paymentMethod?: string
  notes?: string | null
}): Promise<{ ok: boolean; message?: string; idempotent?: boolean }> {
  if (!UUID_REGEX.test(input.invoiceId)) {
    return { ok: false, message: 'Invalid invoice id.' }
  }

  if (!Number.isFinite(input.amountReceived) || input.amountReceived <= 0) {
    return { ok: false, message: 'Payment amount must be greater than zero.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user?.id) {
    return { ok: false, message: 'Authentication required.' }
  }

  const { data: invoice, error: invoiceErr } = await supabase
    .from('financial_invoices')
    .select('id, organization_id, study_id, study_subject_id, visit_id, invoice_status')
    .eq('id', input.invoiceId)
    .maybeSingle()

  if (invoiceErr) {
    return {
      ok: false,
      message: coordinatorMessageFromError(invoiceErr, {
        context: 'record_invoice_payment',
        fallbackMessage: 'Invoice not found.',
      }),
    }
  }
  if (!invoice) return { ok: false, message: 'Invoice not found.' }
  if (invoice.invoice_status !== 'sent') {
    return { ok: false, message: 'Invoice must be sent before recording payment.' }
  }

  try {
    const serviceSupabase = await createServiceClient()
    const result = await recordInvoicePayment({
      supabase: serviceSupabase,
      invoiceId: input.invoiceId,
      amountReceived: input.amountReceived,
      paymentReference: input.paymentReference,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
    })

    if (!result.idempotent && result.paymentId) {
      void logAuditEvent({
        organizationId: String(invoice.organization_id),
        actorUserId: user.id,
        action: 'INVOICE_PAYMENT_RECORDED',
        target: input.invoiceId,
        metadata: {
          payment_id: result.paymentId,
          payment_reference: result.paymentReference,
          amount_received: result.amountReceived,
          amount_applied: result.amountApplied,
          amount_unapplied: result.amountUnapplied,
          invoice_status: result.invoiceStatus,
          study_id: invoice.study_id,
          study_subject_id: invoice.study_subject_id,
          visit_id: invoice.visit_id,
        },
      })
    }

    revalidatePath(input.visitPath)
    revalidatePath(input.studyPath)
    revalidatePath(input.subjectPath)
    revalidatePath('/studies')

    return { ok: true, idempotent: result.idempotent }
  } catch (err) {
    return {
      ok: false,
      message: coordinatorMessageFromError(err, {
        context: 'record_invoice_payment',
        fallbackMessage: 'Payment could not be recorded.',
      }),
    }
  }
}
