import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'
import type { CompositionSnapshotForPackage } from './source-package-types'

export async function loadCompositionSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  compositionSnapshotId: string,
): Promise<CompositionSnapshotForPackage> {
  const { data, error } = await supabase
    .from('study_runtime_composition_snapshots')
    .select('id, organization_id, study_id, graph_json, graph_hash, snapshot_status')
    .eq('id', compositionSnapshotId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Composition snapshot not found.')
  if (data.snapshot_status !== 'compiled') {
    throw new Error('Only compiled composition snapshots can generate source packages.')
  }

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    studyId: String(data.study_id),
    graphJson: data.graph_json as StudyRuntimeGraphJson,
    graphHash: String(data.graph_hash),
  }
}

export type CompositionSnapshotListItem = {
  id: string
  graphHash: string
  snapshotStatus: string
  createdAt: string
}

export async function listCompositionSnapshots(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<CompositionSnapshotListItem[]> {
  const { data, error } = await supabase
    .from('study_runtime_composition_snapshots')
    .select('id, graph_hash, snapshot_status, created_at')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('snapshot_status', 'compiled')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    graphHash: String(row.graph_hash),
    snapshotStatus: String(row.snapshot_status),
    createdAt: String(row.created_at),
  }))
}
