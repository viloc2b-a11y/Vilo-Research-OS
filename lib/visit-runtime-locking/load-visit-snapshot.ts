import type { SupabaseClient } from '@supabase/supabase-js'
import { mapVisitRuntimeSnapshotRow, type VisitRuntimeSnapshotRow } from './visit-locking-types'

export async function loadVisitSnapshotByVisitInstance(
  supabase: SupabaseClient,
  organizationId: string,
  visitInstanceId: string,
): Promise<VisitRuntimeSnapshotRow | null> {
  const { data, error } = await supabase
    .from('visit_runtime_snapshots')
    .select('*')
    .eq('visit_instance_id', visitInstanceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapVisitRuntimeSnapshotRow(data as Record<string, unknown>)
}

export async function loadVisitSnapshotById(
  supabase: SupabaseClient,
  organizationId: string,
  snapshotId: string,
): Promise<VisitRuntimeSnapshotRow | null> {
  const { data, error } = await supabase
    .from('visit_runtime_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapVisitRuntimeSnapshotRow(data as Record<string, unknown>)
}
