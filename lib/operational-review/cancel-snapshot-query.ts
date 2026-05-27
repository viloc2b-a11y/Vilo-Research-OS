import type { SupabaseClient } from '@supabase/supabase-js'
import { appendQueryEvent } from './append-query-event'
import { loadSnapshotQuery } from './list-snapshot-queries'
import {
  mapVisitSnapshotQueryRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export type CancelSnapshotQueryArgs = {
  supabase: SupabaseClient
  organizationId: string
  queryId: string
  actorId: string
  reason?: string
}

export async function cancelSnapshotQuery(
  args: CancelSnapshotQueryArgs,
): Promise<VisitSnapshotQueryRow> {
  const existing = await loadSnapshotQuery(args.supabase, args.organizationId, args.queryId)
  if (!existing) throw new Error('Query not found.')
  if (existing.metadata.review_anchor) {
    throw new Error('Review anchor queries cannot be cancelled.')
  }
  if (existing.queryStatus === QUERY_STATUS.CANCELLED) {
    return existing
  }
  if (existing.queryStatus === QUERY_STATUS.RESOLVED) {
    throw new Error('Resolved queries cannot be cancelled.')
  }

  const now = new Date().toISOString()
  const metadata = {
    ...existing.metadata,
    ...(args.reason?.trim() ? { cancel_reason: args.reason.trim() } : {}),
  }

  const { data, error } = await args.supabase
    .from('visit_snapshot_queries')
    .update({
      query_status: QUERY_STATUS.CANCELLED,
      metadata,
      updated_at: now,
    })
    .eq('id', args.queryId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to cancel query: ${error?.message ?? 'Unknown error'}`)
  }

  const query = mapVisitSnapshotQueryRow(data as Record<string, unknown>)

  await appendQueryEvent({
    supabase: args.supabase,
    query,
    eventType: QUERY_EVENT_TYPE.QUERY_CANCELLED,
    actorId: args.actorId,
    eventPayload: { reason: args.reason?.trim() ?? null },
  })

  return query
}
