import type { SupabaseClient } from '@supabase/supabase-js'
import { mapVisitRuntimeInstanceRow, type VisitRuntimeInstanceRow } from './visit-runtime-types'

export async function listVisitInstances(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  subjectId: string,
): Promise<VisitRuntimeInstanceRow[]> {
  const { data, error } = await supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapVisitRuntimeInstanceRow(row as Record<string, unknown>))
}
