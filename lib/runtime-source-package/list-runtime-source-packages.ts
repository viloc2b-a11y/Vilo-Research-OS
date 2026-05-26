import type { SupabaseClient } from '@supabase/supabase-js'
import { mapRuntimeSourcePackageRow, type RuntimeSourcePackageRow } from './source-package-types'

export async function listRuntimeSourcePackages(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<RuntimeSourcePackageRow[]> {
  const { data, error } = await supabase
    .from('runtime_source_packages')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('package_version', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapRuntimeSourcePackageRow(row as Record<string, unknown>))
}
