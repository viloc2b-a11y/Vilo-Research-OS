import type { SupabaseClient } from '@supabase/supabase-js'
import { mapVisitRuntimeSnapshotRow, type VisitRuntimeSnapshotRow } from './visit-locking-types'

export async function listVisitSnapshots(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  subjectId: string,
): Promise<VisitRuntimeSnapshotRow[]> {
  const { data, error } = await supabase
    .from('visit_runtime_snapshots')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('subject_id', subjectId)
    .order('locked_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapVisitRuntimeSnapshotRow(row as Record<string, unknown>))
}
