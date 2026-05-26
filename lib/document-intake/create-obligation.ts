import type { SupabaseClient } from '@supabase/supabase-js'
import { appendComplianceAuditEvent } from './audit-ledger'
import { loadComplianceDocumentForOrganization } from './load-document-for-org'
import type { ComplianceObligationRow, CreateObligationInput } from './obligation-types'
import { validateObligationInput } from './validate-obligation-input'

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

export type CreateComplianceObligationsArgs = {
  supabase: SupabaseClient
  organizationId: string
  documentId: string
  obligations: CreateObligationInput[]
  requestedBy: string
  actorRole?: string | null
}

export async function createComplianceObligations(
  args: CreateComplianceObligationsArgs,
): Promise<{ obligations: ComplianceObligationRow[] }> {
  if (args.obligations.length === 0) {
    throw new Error('At least one obligation is required.')
  }

  const document = await loadComplianceDocumentForOrganization(
    args.supabase,
    args.organizationId,
    args.documentId,
  )
  if (!document) {
    throw new Error('Document not found in this organization.')
  }

  const created: ComplianceObligationRow[] = []

  for (const input of args.obligations) {
    const validation = validateObligationInput(input)
    if (!validation.ok) {
      throw new Error(validation.message)
    }

    const { data, error } = await args.supabase
      .from('compliance_obligations')
      .insert({
        organization_id: args.organizationId,
        document_id: args.documentId,
        obligation_type: input.obligation_type,
        acknowledgement_type: input.acknowledgement_type ?? null,
        signature_meaning: input.signature_meaning ?? null,
        assigned_role: input.assigned_role?.trim() || null,
        assigned_user_id: input.assigned_user_id ?? null,
        requested_by: args.requestedBy,
        due_date: input.due_date ?? null,
        status: 'pending',
        reminder_policy: input.reminder_policy ?? {},
        escalation_policy: input.escalation_policy ?? {},
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create obligation: ${error?.message ?? 'Unknown error'}`)
    }

    const obligation = mapRow(data as Record<string, unknown>)
    created.push(obligation)

    await appendComplianceAuditEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      documentId: args.documentId,
      eventType: 'obligation_created',
      actorId: args.requestedBy,
      actorRole: args.actorRole ?? null,
      eventPayload: {
        obligation_id: obligation.id,
        obligation_type: obligation.obligationType,
        acknowledgement_type: obligation.acknowledgementType,
        signature_meaning: obligation.signatureMeaning,
        assigned_role: obligation.assignedRole,
        assigned_user_id: obligation.assignedUserId,
        due_date: obligation.dueDate,
        reminder_policy: obligation.reminderPolicy,
      },
    })
  }

  return { obligations: created }
}
