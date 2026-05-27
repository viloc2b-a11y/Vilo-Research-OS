import type { SupabaseClient } from '@supabase/supabase-js'
import { mapPublicationRow, type RuntimeSourcePackagePublicationRow } from './runtime-source-publication-types'

export async function listRuntimeSourcePublications(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<RuntimeSourcePackagePublicationRow[]> {
  const { data, error } = await args.supabase
    .from('runtime_source_package_publications')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .order('publication_version', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPublicationRow(row as Record<string, unknown>))
}

