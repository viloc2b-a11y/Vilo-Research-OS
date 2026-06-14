import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRBApprovalRow } from './regulatory-types'

function mapRow(row: Record<string, unknown>): IRBApprovalRow {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    organizationId: String(row.organization_id),
    approvalType: row.approval_type as IRBApprovalRow['approvalType'],
    approvalNumber: row.approval_number ? String(row.approval_number) : null,
    approvedDate: String(row.approved_date),
    expirationDate: row.expiration_date ? String(row.expiration_date) : null,
    submissionDate: row.submission_date ? String(row.submission_date) : null,
    nextRenewalDueDate: row.next_renewal_due_date ? String(row.next_renewal_due_date) : null,
    status: row.status as IRBApprovalRow['status'],
    notes: row.notes ? String(row.notes) : null,
  }
}

export async function loadIRBApprovals(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<IRBApprovalRow[]> {
  const { supabase, organizationId, studyId } = args

  const { data, error } = await supabase
    .from('irb_approvals')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('approved_date', { ascending: false })

  if (error) throw new Error(`loadIRBApprovals: ${error.message}`)

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}
