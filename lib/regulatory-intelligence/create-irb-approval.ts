import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRBApprovalRow } from './regulatory-types'

export async function createIRBApproval(args: {
  supabase: SupabaseClient
  organizationId: string
  input: Omit<IRBApprovalRow, 'id'>
  createdBy: string
}): Promise<IRBApprovalRow> {
  const { supabase, organizationId, input, createdBy } = args

  const { data, error } = await supabase
    .from('irb_approvals')
    .insert({
      organization_id: organizationId,
      study_id: input.studyId,
      approval_type: input.approvalType,
      approval_number: input.approvalNumber ?? null,
      approved_date: input.approvedDate,
      expiration_date: input.expirationDate ?? null,
      submission_date: input.submissionDate ?? null,
      next_renewal_due_date: input.nextRenewalDueDate ?? null,
      status: input.status,
      notes: input.notes ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createIRBApproval: ${error.message}`)
  if (!data) throw new Error('createIRBApproval: no data returned')

  const row = data as Record<string, unknown>

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
