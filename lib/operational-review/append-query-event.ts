import type { SupabaseClient } from '@supabase/supabase-js'
import { buildQueryStateSnapshot, computeQueryStateHash } from './query-state-hash'
import {
  mapVisitSnapshotQueryEventRow,
  type QueryEventType,
  type VisitSnapshotQueryEventRow,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export type AppendQueryEventArgs = {
  supabase: SupabaseClient
  query: VisitSnapshotQueryRow
  eventType: QueryEventType
  actorId?: string | null
  eventPayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  queryIdOverride?: string
}

export async function appendQueryEvent(
  args: AppendQueryEventArgs,
): Promise<VisitSnapshotQueryEventRow> {
  const stateSnapshot = buildQueryStateSnapshot(args.query)
  const stateHash = computeQueryStateHash(stateSnapshot)
  const eventTimestamp = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('visit_snapshot_query_events')
    .insert({
      organization_id: args.query.organizationId,
      study_id: args.query.studyId,
      subject_id: args.query.subjectId,
      snapshot_id: args.query.snapshotId,
      query_id: args.queryIdOverride ?? args.query.id,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      event_timestamp: eventTimestamp,
      event_payload: args.eventPayload ?? {},
      state_hash: stateHash,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to append query event: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitSnapshotQueryEventRow(data as Record<string, unknown>)
}
