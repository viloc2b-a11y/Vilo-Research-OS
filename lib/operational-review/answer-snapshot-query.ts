import type { SupabaseClient } from '@supabase/supabase-js'
import { appendQueryEvent } from './append-query-event'
import { loadSnapshotQuery } from './list-snapshot-queries'
import {
  mapVisitSnapshotQueryRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export type AnswerSnapshotQueryArgs = {
  supabase: SupabaseClient
  organizationId: string
  queryId: string
  actorId: string
  answerText: string
}

export async function answerSnapshotQuery(
  args: AnswerSnapshotQueryArgs,
): Promise<VisitSnapshotQueryRow> {
  const existing = await loadSnapshotQuery(args.supabase, args.organizationId, args.queryId)
  if (!existing) throw new Error('Query not found.')
  if (existing.metadata.review_anchor) {
    throw new Error('Review anchor queries cannot be answered.')
  }
  if (existing.queryStatus === QUERY_STATUS.RESOLVED || existing.queryStatus === QUERY_STATUS.CANCELLED) {
    throw new Error(`Cannot answer query in status "${existing.queryStatus}".`)
  }

  const answerText = args.answerText.trim()
  if (!answerText) throw new Error('answer_text is required.')

  const now = new Date().toISOString()
  const metadata = { ...existing.metadata, answer_text: answerText }

  const { data, error } = await args.supabase
    .from('visit_snapshot_queries')
    .update({
      query_status: QUERY_STATUS.ANSWERED,
      metadata,
      updated_at: now,
    })
    .eq('id', args.queryId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to answer query: ${error?.message ?? 'Unknown error'}`)
  }

  const query = mapVisitSnapshotQueryRow(data as Record<string, unknown>)

  await appendQueryEvent({
    supabase: args.supabase,
    query,
    eventType: QUERY_EVENT_TYPE.QUERY_ANSWERED,
    actorId: args.actorId,
    eventPayload: { answer_text: answerText },
  })

  return query
}
