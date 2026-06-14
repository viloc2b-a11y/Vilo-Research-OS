import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvestigatorCredentialRow } from './regulatory-types'

export async function createInvestigatorCredential(args: {
  supabase: SupabaseClient
  organizationId: string
  input: Omit<InvestigatorCredentialRow, 'id'>
  createdBy: string
}): Promise<InvestigatorCredentialRow> {
  const { supabase, organizationId, input, createdBy } = args

  const { data, error } = await supabase
    .from('investigator_credentials')
    .insert({
      organization_id: organizationId,
      user_id: input.userId,
      credential_type: input.credentialType,
      study_id: input.studyId ?? null,
      issue_date: input.issueDate ?? null,
      expiration_date: input.expirationDate ?? null,
      credential_number: input.credentialNumber ?? null,
      status: input.status,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createInvestigatorCredential: ${error.message}`)
  if (!data) throw new Error('createInvestigatorCredential: no data returned')

  const row = data as Record<string, unknown>

  return {
    id: String(row.id),
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    credentialType: row.credential_type as InvestigatorCredentialRow['credentialType'],
    studyId: row.study_id ? String(row.study_id) : null,
    issueDate: row.issue_date ? String(row.issue_date) : null,
    expirationDate: row.expiration_date ? String(row.expiration_date) : null,
    credentialNumber: row.credential_number ? String(row.credential_number) : null,
    status: row.status as InvestigatorCredentialRow['status'],
  }
}
