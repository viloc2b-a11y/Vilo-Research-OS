import type { SupabaseClient } from '@supabase/supabase-js'
import { OperationalSignatureStateError } from './operational-signature-errors'

export async function assertOperationalSignatureStudyScope(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    studyId: string
  },
): Promise<void> {
  const { data, error } = await supabase
    .from('studies')
    .select('id')
    .eq('id', input.studyId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    throw new OperationalSignatureStateError(
      'Study does not belong to the requested organization.',
    )
  }
}
