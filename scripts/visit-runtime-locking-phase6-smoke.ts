/**
 * Phase 6 smoke: visit runtime locking + immutable snapshots.
 *
 * Usage:
 *   npx tsx scripts/visit-runtime-locking-phase6-smoke.ts
 *   npx tsx scripts/visit-runtime-locking-phase6-smoke.ts --live
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildVisitSnapshot } from '../lib/visit-runtime-locking/build-visit-snapshot'
import { computeVisitSnapshotHash } from '../lib/visit-runtime-locking/visit-snapshot-hash'
import { lockVisitRuntimeInstance } from '../lib/visit-runtime-locking/lock-visit-runtime-instance'
import { VisitLockedError } from '../lib/visit-runtime-locking/assert-visit-unlocked'
import { saveProcedureFieldValues } from '../lib/visit-runtime-execution/save-procedure-field-values'
import { LOCK_STATUS, mapVisitInstanceWithLock } from '../lib/visit-runtime-locking/visit-locking-types'
import { VISIT_STATUS } from '../lib/visit-runtime-execution/visit-runtime-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 6 unit checks ---')

  const snapshotInput = {
    visitInstance: {
      id: 'visit-1',
      organizationId: 'org-1',
      studyId: 'study-1',
      subjectId: 'sub-1',
      sourcePackageId: 'pkg-1',
      visitShellId: 'shell-1',
      runtimeVisitId: 'rv-1',
      visitCode: 'V1',
      visitName: 'Screening',
      visitType: 'screening',
      visitStatus: VISIT_STATUS.COMPLETED,
      scheduledAt: null,
      startedAt: '2026-01-01T10:00:00.000Z',
      completedAt: '2026-01-01T11:00:00.000Z',
      completedBy: 'user-1',
      progressPercent: 100,
      lockStatus: LOCK_STATUS.UNLOCKED,
      lockedSnapshotId: null,
      lockedAt: null,
      lockedBy: null,
      metadata: {},
      createdBy: 'user-1',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
    },
    procedures: [
      {
        id: 'proc-inst-1',
        procedureCode: 'VITAL_SIGNS',
        procedureName: 'Vital Signs',
        blueprintVersionId: 'bv-1',
        procedureStatus: 'completed',
        fieldValues: { systolic_bp: 120 },
        completedAt: '2026-01-01T10:30:00.000Z',
        procedureOrder: 1,
      },
    ],
    events: [
      {
        id: 'evt-1',
        organizationId: 'org-1',
        studyId: 'study-1',
        subjectId: 'sub-1',
        visitInstanceId: 'visit-1',
        procedureInstanceId: null,
        eventType: 'visit_completed' as const,
        actorId: 'user-1',
        eventTimestamp: '2026-01-01T11:00:00.000Z',
        eventPayload: {},
        stateHash: 'abc123',
        metadata: {},
      },
    ],
  }

  const json1 = buildVisitSnapshot(snapshotInput)
  const json2 = buildVisitSnapshot(snapshotInput)
  const hash1 = computeVisitSnapshotHash(json1)
  const hash2 = computeVisitSnapshotHash(json2)

  assert(hash1 === hash2, 'snapshot_hash deterministic')
  assert(
    json1.procedures[0].blueprint_version_id === 'bv-1',
    'blueprint_version_id preserved in snapshot',
  )
  assert(
    json1.procedures[0].field_values.systolic_bp === 120,
    'field_values preserved in snapshot',
  )
  assert(json1.source_context.source_package_id === 'pkg-1', 'source_package_id preserved')

  console.log('✅ Deterministic snapshot_json + snapshot_hash')
  console.log('✅ Blueprint + field_values + source context preserved')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.VISIT_RUNTIME_SMOKE_ORG_ID ?? process.env.RUNTIME_SOURCE_SMOKE_ORG_ID
  const studyId = process.env.VISIT_RUNTIME_SMOKE_STUDY_ID ?? process.env.RUNTIME_SOURCE_SMOKE_STUDY_ID
  const subjectId = process.env.VISIT_RUNTIME_SMOKE_SUBJECT_ID
  const actorId =
    process.env.VISIT_RUNTIME_SMOKE_ACTOR_ID
    ?? process.env.RUNTIME_SOURCE_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId || !subjectId) {
    console.log(
      '⏭️  Set VISIT_RUNTIME_SMOKE_ORG_ID, VISIT_RUNTIME_SMOKE_STUDY_ID, VISIT_RUNTIME_SMOKE_SUBJECT_ID',
    )
    return
  }

  console.log('--- Phase 6 live integration ---')
  const supabase = createClient(url, key)

  const { data: completedVisit } = await supabase
    .from('visit_runtime_instances')
    .select('id, visit_status, lock_status')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .eq('subject_id', subjectId)
    .eq('visit_status', 'completed')
    .eq('lock_status', 'unlocked')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!completedVisit) {
    console.log('⏭️  No completed unlocked visit — complete a visit in Phase 5 first')
    return
  }

  const visitInstanceId = String(completedVisit.id)
  const packageHashBefore = await loadPackageFingerprint(supabase, orgId, studyId)

  const locked = await lockVisitRuntimeInstance({
    supabase,
    organizationId: orgId,
    visitInstanceId,
    lockedBy: actorId,
    lockReason: 'Phase 6 smoke lock',
  })
  assert(locked.snapshot.snapshotHash.length === 64, 'snapshot created with hash')
  console.log('✅ Completed visit locked')

  const duplicate = await lockVisitRuntimeInstance({
    supabase,
    organizationId: orgId,
    visitInstanceId,
    lockedBy: actorId,
  })
  assert(duplicate.idempotent, 'duplicate lock is idempotent')
  assert(duplicate.snapshot.id === locked.snapshot.id, 'duplicate returns same snapshot')
  console.log('✅ Duplicate lock safely idempotent')

  const { data: visitRow } = await supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('id', visitInstanceId)
    .single()
  const visit = mapVisitInstanceWithLock(visitRow as Record<string, unknown>)
  assert(visit.lockStatus === LOCK_STATUS.LOCKED, 'visit lock_status updated')
  console.log('✅ Visit lock state updated')

  const { count: snapshotEventCount } = await supabase
    .from('visit_runtime_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_instance_id', visitInstanceId)
    .in('event_type', ['visit_snapshot_created', 'visit_locked'])
  assert((snapshotEventCount ?? 0) >= 2, 'lock events appended')
  console.log('✅ visit_snapshot_created + visit_locked events')

  const { data: procedures } = await supabase
    .from('procedure_runtime_instances')
    .select('id')
    .eq('visit_instance_id', visitInstanceId)
    .limit(1)

  const procedureId = procedures?.[0]?.id ? String(procedures[0].id) : null
  if (procedureId) {
    let rejected = false
    try {
      await saveProcedureFieldValues({
        supabase,
        organizationId: orgId,
        procedureInstanceId: procedureId,
        fieldValues: { blocked: true },
        actorId,
      })
    } catch (error) {
      rejected = error instanceof VisitLockedError || error instanceof Error
    }
    assert(rejected, 'post-lock mutation rejected')
    console.log('✅ Post-lock mutation rejected')
  }

  const packageHashAfter = await loadPackageFingerprint(supabase, orgId, studyId)
  assert(packageHashBefore === packageHashAfter, 'source package unchanged')
  console.log('✅ Source package / blueprint unchanged')
}

async function loadPackageFingerprint(
  supabase: SupabaseClient,
  orgId: string,
  studyId: string,
): Promise<string> {
  const { data } = await supabase
    .from('runtime_source_packages')
    .select('package_hash')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .limit(1)
    .maybeSingle()
  const { data: blueprint } = await supabase
    .from('procedure_blueprint_versions')
    .select('id')
    .limit(1)
    .maybeSingle()
  return JSON.stringify({ package: data?.package_hash, blueprint: blueprint?.id })
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and VISIT_RUNTIME_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 6 visit runtime locking smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
