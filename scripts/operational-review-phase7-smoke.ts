/**
 * Phase 7 smoke: operational review + query runtime.
 *
 * Usage:
 *   npx tsx scripts/operational-review-phase7-smoke.ts
 *   npx tsx scripts/operational-review-phase7-smoke.ts --live
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildQueryStateSnapshot, computeQueryStateHash } from '../lib/operational-review/query-state-hash'
import { createSnapshotReview } from '../lib/operational-review/create-snapshot-review'
import { startSnapshotReview } from '../lib/operational-review/start-snapshot-review'
import { completeSnapshotReview } from '../lib/operational-review/complete-snapshot-review'
import { openSnapshotQuery } from '../lib/operational-review/open-snapshot-query'
import { answerSnapshotQuery } from '../lib/operational-review/answer-snapshot-query'
import { resolveSnapshotQuery } from '../lib/operational-review/resolve-snapshot-query'
import { hasUnresolvedQueriesInList } from '../lib/operational-review/list-snapshot-queries'
import {
  QUERY_EVENT_TYPE,
  QUERY_STATUS,
  type VisitSnapshotQueryRow,
} from '../lib/operational-review/operational-review-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 7 unit checks ---')

  const hash1 = computeQueryStateHash(
    buildQueryStateSnapshot({
      id: 'q1',
      queryStatus: QUERY_STATUS.OPEN,
      priority: 'normal',
      metadata: {},
      resolutionText: null,
    }),
  )
  const hash2 = computeQueryStateHash(
    buildQueryStateSnapshot({
      id: 'q1',
      queryStatus: QUERY_STATUS.OPEN,
      priority: 'normal',
      metadata: {},
      resolutionText: null,
    }),
  )
  assert(hash1 === hash2, 'query state_hash deterministic')

  const unresolvedQueries: VisitSnapshotQueryRow[] = [
    {
      id: 'q1',
      organizationId: 'org',
      studyId: 'study',
      subjectId: 'sub',
      snapshotId: 'snap',
      reviewId: 'rev',
      queryScope: 'field',
      procedureInstanceId: 'proc',
      procedureCode: 'vital_signs',
      fieldId: 'systolic_bp',
      fieldLabel: 'Systolic BP',
      queryText: 'Confirm value',
      queryStatus: QUERY_STATUS.ANSWERED,
      priority: 'normal',
      assignedRole: 'crc',
      assignedUserId: null,
      openedBy: 'user',
      openedAt: new Date().toISOString(),
      resolvedBy: null,
      resolvedAt: null,
      resolutionText: null,
      metadata: { answer_text: 'Confirmed' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  assert(hasUnresolvedQueriesInList(unresolvedQueries), 'answered query blocks review completion')

  const resolvedQueries: VisitSnapshotQueryRow[] = [
    {
      ...unresolvedQueries[0],
      queryStatus: QUERY_STATUS.RESOLVED,
      resolutionText: 'Accepted',
    },
  ]
  assert(!hasUnresolvedQueriesInList(resolvedQueries), 'resolved queries allow completion')

  console.log('✅ Query state hash + completion gate rules')
}

async function loadSnapshotHash(supabase: SupabaseClient, snapshotId: string): Promise<string> {
  const { data } = await supabase
    .from('visit_runtime_snapshots')
    .select('snapshot_json, snapshot_hash')
    .eq('id', snapshotId)
    .maybeSingle()
  return JSON.stringify({ hash: data?.snapshot_hash, json: data?.snapshot_json })
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId =
    process.env.OPERATIONAL_REVIEW_SMOKE_ORG_ID ?? process.env.VISIT_RUNTIME_SMOKE_ORG_ID
  const studyId =
    process.env.OPERATIONAL_REVIEW_SMOKE_STUDY_ID ?? process.env.VISIT_RUNTIME_SMOKE_STUDY_ID
  const subjectId = process.env.OPERATIONAL_REVIEW_SMOKE_SUBJECT_ID ?? process.env.VISIT_RUNTIME_SMOKE_SUBJECT_ID
  const actorId =
    process.env.OPERATIONAL_REVIEW_SMOKE_ACTOR_ID
    ?? process.env.VISIT_RUNTIME_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId || !subjectId) {
    console.log('⏭️  Set OPERATIONAL_REVIEW_SMOKE_* env vars for live checks')
    return
  }

  console.log('--- Phase 7 live integration ---')
  const supabase = createClient(url, key)

  const { data: snapshot } = await supabase
    .from('visit_runtime_snapshots')
    .select('id, study_id, subject_id, snapshot_json')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .eq('subject_id', subjectId)
    .eq('snapshot_status', 'locked')
    .order('locked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) {
    console.log('⏭️  No locked snapshot — lock a visit in Phase 6 first')
    return
  }

  const snapshotId = String(snapshot.id)
  const hashBefore = await loadSnapshotHash(supabase, snapshotId)

  const review = await createSnapshotReview({
    supabase,
    input: {
      organization_id: orgId,
      study_id: studyId,
      subject_id: subjectId,
      snapshot_id: snapshotId,
    },
    createdBy: actorId,
  })
  console.log('✅ Review created for locked snapshot')

  await startSnapshotReview({
    supabase,
    organizationId: orgId,
    reviewId: review.id,
    actorId,
  })
  console.log('✅ Review started')

  const json = snapshot.snapshot_json as {
    procedures?: Array<{ procedure_instance_id: string; procedure_code: string }>
  }
  const procedure = json.procedures?.[0]

  const query = await openSnapshotQuery({
    supabase,
    input: {
      organization_id: orgId,
      study_id: studyId,
      subject_id: subjectId,
      snapshot_id: snapshotId,
      review_id: review.id,
      query_scope: 'field',
      procedure_instance_id: procedure?.procedure_instance_id,
      procedure_code: procedure?.procedure_code,
      field_id: 'systolic_bp',
      field_label: 'Systolic BP',
      query_text: 'Please confirm value source.',
    },
    openedBy: actorId,
  })

  const { count: openedEvents } = await supabase
    .from('visit_snapshot_query_events')
    .select('id', { count: 'exact', head: true })
    .eq('query_id', query.id)
    .eq('event_type', QUERY_EVENT_TYPE.QUERY_OPENED)
  assert((openedEvents ?? 0) >= 1, 'query_opened event')
  console.log('✅ Field-level query opened')

  await answerSnapshotQuery({
    supabase,
    organizationId: orgId,
    queryId: query.id,
    actorId,
    answerText: 'Confirmed from source worksheet.',
  })

  let completionBlocked = false
  try {
    await completeSnapshotReview({
      supabase,
      organizationId: orgId,
      reviewId: review.id,
      actorId,
    })
  } catch {
    completionBlocked = true
  }
  assert(completionBlocked, 'answered query blocks review completion')
  console.log('✅ Unresolved answered query blocks review completion')

  await resolveSnapshotQuery({
    supabase,
    organizationId: orgId,
    queryId: query.id,
    actorId,
    resolutionText: 'Response accepted.',
  })
  console.log('✅ Query resolved')

  await completeSnapshotReview({
    supabase,
    organizationId: orgId,
    reviewId: review.id,
    actorId,
  })
  console.log('✅ Review completed')

  const { count: eventCount } = await supabase
    .from('visit_snapshot_query_events')
    .select('id', { count: 'exact', head: true })
    .eq('snapshot_id', snapshotId)
  assert((eventCount ?? 0) >= 4, 'append-only query events')
  console.log('✅ Query event timeline persisted')

  const hashAfter = await loadSnapshotHash(supabase, snapshotId)
  assert(hashBefore === hashAfter, 'snapshot_json unchanged')
  console.log('✅ Snapshot + source package unchanged')
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and OPERATIONAL_REVIEW_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 7 operational review smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
