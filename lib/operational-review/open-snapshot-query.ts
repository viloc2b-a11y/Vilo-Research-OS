import type { SupabaseClient } from '@supabase/supabase-js'
import { assertLockedSnapshot } from './assert-locked-snapshot'
import { appendQueryEvent } from './append-query-event'
import {
  mapVisitSnapshotQueryRow,
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  REVIEW_STATUS,
  type OpenSnapshotQueryInput,
  type VisitSnapshotQueryRow,
} from './operational-review-types'

export type OpenSnapshotQueryArgs = {
  supabase: SupabaseClient
  input: OpenSnapshotQueryInput
  openedBy: string
}

export async function openSnapshotQuery(args: OpenSnapshotQueryArgs): Promise<VisitSnapshotQueryRow> {
  const queryText = args.input.query_text.trim()
  if (!queryText) throw new Error('query_text is required.')

  await assertLockedSnapshot(
    args.supabase,
    args.input.organization_id,
    args.input.study_id,
    args.input.subject_id,
    args.input.snapshot_id,
  )

  const now = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('visit_snapshot_queries')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      subject_id: args.input.subject_id,
      snapshot_id: args.input.snapshot_id,
      review_id: args.input.review_id ?? null,
      query_scope: args.input.query_scope,
      procedure_instance_id: args.input.procedure_instance_id ?? null,
      procedure_code: args.input.procedure_code ?? null,
      field_id: args.input.field_id ?? null,
      field_label: args.input.field_label ?? null,
      query_text: queryText,
      query_status: QUERY_STATUS.OPEN,
      priority: args.input.priority ?? 'normal',
      assigned_role: args.input.assigned_role ?? 'crc',
      assigned_user_id: args.input.assigned_user_id ?? null,
      opened_by: args.openedBy,
      opened_at: now,
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to open query: ${error?.message ?? 'Unknown error'}`)
  }

  const query = mapVisitSnapshotQueryRow(data as Record<string, unknown>)

  if (args.input.review_id) {
    await args.supabase
      .from('visit_snapshot_reviews')
      .update({
        review_status: REVIEW_STATUS.QUERIES_OPEN,
        updated_at: now,
      })
      .eq('id', args.input.review_id)
      .eq('organization_id', args.input.organization_id)
      .in('review_status', [REVIEW_STATUS.IN_REVIEW, REVIEW_STATUS.QUERIES_OPEN])
  }

  await appendQueryEvent({
    supabase: args.supabase,
    query,
    eventType: QUERY_EVENT_TYPE.QUERY_OPENED,
    actorId: args.openedBy,
    eventPayload: {
      query_scope: query.queryScope,
      field_id: query.fieldId,
      procedure_code: query.procedureCode,
    },
  })

  return query
}
