import type { SupabaseClient } from '@supabase/supabase-js'
import { appendComplianceAuditEvent } from './audit-ledger'
import type { ComplianceObligationRow } from './obligation-types'

function mapRow(row: Record<string, unknown>): ComplianceObligationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    documentId: String(row.document_id),
    obligationType: row.obligation_type as ComplianceObligationRow['obligationType'],
    acknowledgementType: (row.acknowledgement_type as ComplianceObligationRow['acknowledgementType']) ?? null,
    signatureMeaning: (row.signature_meaning as ComplianceObligationRow['signatureMeaning']) ?? null,
    assignedRole: row.assigned_role ? String(row.assigned_role) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    requestedBy: String(row.requested_by),
    requestedAt: String(row.requested_at),
    dueDate: row.due_date ? String(row.due_date) : null,
    status: row.status as ComplianceObligationRow['status'],
    completedBy: row.completed_by ? String(row.completed_by) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completionMeaning: row.completion_meaning ? String(row.completion_meaning) : null,
    reminderPolicy: (row.reminder_policy ?? {}) as Record<string, unknown>,
    escalationPolicy: (row.escalation_policy ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export type CancelComplianceObligationArgs = {
  supabase: SupabaseClient
  organizationId: string
  obligationId: string
  cancelledBy: string
  reason: string
  actorRole?: string | null
}

export async function cancelComplianceObligation(
  args: CancelComplianceObligationArgs,
): Promise<ComplianceObligationRow> {
  const reason = args.reason.trim()
  if (!reason) {
    throw new Error('Cancellation reason is required.')
  }

  const { data: existing, error: loadError } = await args.supabase
    .from('compliance_obligations')
    .select('*')
    .eq('id', args.obligationId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Obligation not found.')
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    throw new Error(`Obligation cannot be cancelled from status "${existing.status}".`)
  }

  const updatedAt = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('compliance_obligations')
    .update({
      status: 'cancelled',
      updated_at: updatedAt,
      metadata: {
        ...((existing.metadata ?? {}) as Record<string, unknown>),
        cancel_reason: reason,
        cancelled_by: args.cancelledBy,
        cancelled_at: updatedAt,
      },
    })
    .eq('id', args.obligationId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to cancel obligation: ${error?.message ?? 'Unknown error'}`)
  }

  const obligation = mapRow(data as Record<string, unknown>)

  await appendComplianceAuditEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    documentId: obligation.documentId,
    eventType: 'obligation_cancelled',
    actorId: args.cancelledBy,
    actorRole: args.actorRole ?? null,
    eventPayload: {
      obligation_id: obligation.id,
      obligation_type: obligation.obligationType,
      reason,
      cancelled_at: updatedAt,
    },
  })

  return obligation
}
