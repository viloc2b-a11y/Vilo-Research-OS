import type { SupabaseClient } from '@supabase/supabase-js'
import { appendQueryEvent } from './append-query-event'
import { loadSnapshotQuery } from './list-snapshot-queries'
import {
  mapVisitSnapshotQueryRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export type ResolveSnapshotQueryArgs = {
  supabase: SupabaseClient
  organizationId: string
  queryId: string
  actorId: string
  resolutionText: string
}

export async function resolveSnapshotQuery(
  args: ResolveSnapshotQueryArgs,
): Promise<VisitSnapshotQueryRow> {
  const existing = await loadSnapshotQuery(args.supabase, args.organizationId, args.queryId)
  if (!existing) throw new Error('Query not found.')
  if (existing.metadata.review_anchor) {
    throw new Error('Review anchor queries cannot be resolved through this endpoint.')
  }
  if (existing.queryStatus === QUERY_STATUS.CANCELLED) {
    throw new Error('Cancelled queries cannot be resolved.')
  }
  if (existing.queryStatus === QUERY_STATUS.RESOLVED) {
    return existing
  }

  const resolutionText = args.resolutionText.trim()
  if (!resolutionText) throw new Error('resolution_text is required.')

  const now = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('visit_snapshot_queries')
    .update({
      query_status: QUERY_STATUS.RESOLVED,
      resolution_text: resolutionText,
      resolved_by: args.actorId,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', args.queryId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to resolve query: ${error?.message ?? 'Unknown error'}`)
  }

  const query = mapVisitSnapshotQueryRow(data as Record<string, unknown>)

  await appendQueryEvent({
    supabase: args.supabase,
    query,
    eventType: QUERY_EVENT_TYPE.QUERY_RESOLVED,
    actorId: args.actorId,
    eventPayload: { resolution_text: resolutionText },
  })

  return query
}
