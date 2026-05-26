import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingObligationView } from './obligation-types'

export type ListPendingObligationsFilters = {
  organizationId: string
  assignedUserId?: string | null
  assignedRole?: string | null
  documentId?: string | null
  limit?: number
}

export async function listPendingComplianceObligations(
  supabase: SupabaseClient,
  filters: ListPendingObligationsFilters,
): Promise<PendingObligationView[]> {
  let query = supabase
    .from('compliance_obligations')
    .select(
      `
      *,
      compliance_runtime_documents!inner (
        operational_display_name,
        document_classification,
        original_filename
      )
    `,
    )
    .eq('organization_id', filters.organizationId)
    .in('status', ['pending', 'overdue', 'escalated'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('requested_at', { ascending: false })

  if (filters.assignedUserId) {
    query = query.eq('assigned_user_id', filters.assignedUserId)
  }
  if (filters.assignedRole) {
    query = query.eq('assigned_role', filters.assignedRole)
  }
  if (filters.documentId) {
    query = query.eq('document_id', filters.documentId)
  }
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const doc = row.compliance_runtime_documents as {
      operational_display_name: string
      document_classification: string
      original_filename: string
    }
    return {
      id: String(row.id),
      organizationId: String(row.organization_id),
      documentId: String(row.document_id),
      obligationType: row.obligation_type as PendingObligationView['obligationType'],
      acknowledgementType: (row.acknowledgement_type as PendingObligationView['acknowledgementType']) ?? null,
      signatureMeaning: (row.signature_meaning as PendingObligationView['signatureMeaning']) ?? null,
      assignedRole: row.assigned_role ? String(row.assigned_role) : null,
      assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
      requestedBy: String(row.requested_by),
      requestedAt: String(row.requested_at),
      dueDate: row.due_date ? String(row.due_date) : null,
      status: row.status as PendingObligationView['status'],
      completedBy: row.completed_by ? String(row.completed_by) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      completionMeaning: row.completion_meaning ? String(row.completion_meaning) : null,
      reminderPolicy: (row.reminder_policy ?? {}) as Record<string, unknown>,
      escalationPolicy: (row.escalation_policy ?? {}) as Record<string, unknown>,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      documentOperationalDisplayName: String(doc.operational_display_name),
      documentClassification: String(doc.document_classification),
      documentOriginalFilename: String(doc.original_filename),
    }
  })
}
