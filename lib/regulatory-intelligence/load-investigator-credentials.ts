import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvestigatorCredentialRow } from './regulatory-types'

function mapRow(row: Record<string, unknown>): InvestigatorCredentialRow {
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

export async function loadInvestigatorCredentials(args: {
  supabase: SupabaseClient
  organizationId: string
  userId?: string
  studyId?: string
}): Promise<InvestigatorCredentialRow[]> {
  const { supabase, organizationId, userId, studyId } = args

  let query = supabase
    .from('investigator_credentials')
    .select('*')
    .eq('organization_id', organizationId)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (studyId) {
    query = query.or(`study_id.eq.${studyId},study_id.is.null`)
  }

  query = query.order('expiration_date', { ascending: true })

  const { data, error } = await query

  if (error) throw new Error(`loadInvestigatorCredentials: ${error.message}`)

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}
