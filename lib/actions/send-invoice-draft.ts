'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { sendInvoiceDraftForVisit } from '@/lib/financial-runtime/invoicing'
import { coordinatorMessageFromError } from '@/lib/runtime-errors'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

export async function sendInvoiceDraft(input: {
  visitId: string
  visitPath: string
  studyPath: string
  subjectPath: string
}): Promise<{ ok: boolean; message?: string; idempotent?: boolean }> {
  if (!UUID_REGEX.test(input.visitId)) {
    return { ok: false, message: 'Invalid visit id.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user?.id) {
    return { ok: false, message: 'Authentication required.' }
  }

  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select('id, organization_id, study_id, study_subject_id')
    .eq('id', input.visitId)
    .maybeSingle()

  if (visitErr) {
    return {
      ok: false,
      message: coordinatorMessageFromError(visitErr, {
        context: 'send_invoice_draft',
        fallbackMessage: 'Invoice draft not found.',
      }),
    }
  }
  if (!visit) return { ok: false, message: 'Invoice draft not found.' }

  try {
    const serviceSupabase = await createServiceClient()
    const result = await sendInvoiceDraftForVisit({
      supabase: serviceSupabase,
      visitId: input.visitId,
    })

    if (result.invoiceStatus === 'sent') {
      void logAuditEvent({
        organizationId: String(visit.organization_id),
        actorUserId: user.id,
        action: 'INVOICE_DRAFT_SENT',
        target: input.visitId,
        metadata: {
          invoice_id: result.invoiceId,
          invoice_number: result.invoiceNumber,
          line_item_count: result.lineItemCount,
          total_amount: result.totalAmount,
          study_id: visit.study_id,
          study_subject_id: visit.study_subject_id,
        },
      })
    }

    revalidatePath(input.visitPath)
    revalidatePath(input.studyPath)
    revalidatePath(input.subjectPath)
    revalidatePath('/studies')

    return { ok: true, idempotent: result.invoiceStatus === 'sent' && result.lineItemCount === 0 }
  } catch (err) {
    return {
      ok: false,
      message: coordinatorMessageFromError(err, {
        context: 'send_invoice_draft',
        fallbackMessage: 'Invoice send failed.',
      }),
    }
  }
}
