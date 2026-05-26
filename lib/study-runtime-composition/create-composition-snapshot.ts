import type { SupabaseClient } from '@supabase/supabase-js'
import { compileStudyRuntimeGraph } from './compile-study-runtime-graph'
import type { StudyRuntimeGraphJson } from './runtime-composition-types'

export type CompositionSnapshotRow = {
  id: string
  organizationId: string
  studyId: string
  snapshotStatus: string
  graphJson: StudyRuntimeGraphJson
  graphHash: string
  createdBy: string
  createdAt: string
}

export type CreateCompositionSnapshotArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  createdBy: string
  graph?: StudyRuntimeGraphJson
  graphHash?: string
}

export async function createCompositionSnapshot(
  args: CreateCompositionSnapshotArgs,
): Promise<CompositionSnapshotRow> {
  const { graph, graphHash } =
    args.graph && args.graphHash
      ? { graph: args.graph, graphHash: args.graphHash }
      : await compileStudyRuntimeGraph({
          supabase: args.supabase,
          organizationId: args.organizationId,
          studyId: args.studyId,
        })

  const { data, error } = await args.supabase
    .from('study_runtime_composition_snapshots')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      snapshot_status: 'compiled',
      graph_json: graph,
      graph_hash: graphHash,
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create composition snapshot: ${error?.message ?? 'Unknown error'}`)
  }

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    studyId: String(data.study_id),
    snapshotStatus: String(data.snapshot_status),
    graphJson: data.graph_json as StudyRuntimeGraphJson,
    graphHash: String(data.graph_hash),
    createdBy: String(data.created_by),
    createdAt: String(data.created_at),
  }
}
