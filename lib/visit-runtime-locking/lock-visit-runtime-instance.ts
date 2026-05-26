import type { SupabaseClient } from '@supabase/supabase-js'
import { appendVisitRuntimeEvent, buildStateSnapshot } from '@/lib/visit-runtime-execution/append-visit-runtime-event'
import { canCompleteVisit } from '@/lib/visit-runtime-execution/recalculate-visit-progress'
import { loadVisitWorkspace } from '@/lib/visit-runtime-execution/load-visit-workspace'
import { VISIT_RUNTIME_EVENT_TYPE, VISIT_STATUS } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { buildVisitSnapshot } from './build-visit-snapshot'
import { computeVisitSnapshotHash } from './visit-snapshot-hash'
import {
  LOCK_STATUS,
  mapVisitInstanceWithLock,
  mapVisitRuntimeSnapshotRow,
  type LockVisitRuntimeResult,
  type VisitRuntimeSnapshotRow,
} from './visit-locking-types'
import { loadVisitSnapshotByVisitInstance } from './load-visit-snapshot'

export type LockVisitRuntimeInstanceArgs = {
  supabase: SupabaseClient
  organizationId: string
  visitInstanceId: string
  lockedBy: string
  lockReason?: string | null
}

async function loadExistingLockedSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  visitInstanceId: string,
): Promise<VisitRuntimeSnapshotRow | null> {
  return loadVisitSnapshotByVisitInstance(supabase, organizationId, visitInstanceId)
}

export async function lockVisitRuntimeInstance(
  args: LockVisitRuntimeInstanceArgs,
): Promise<LockVisitRuntimeResult> {
  const { data: visitRow, error: visitError } = await args.supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (visitError) throw new Error(visitError.message)
  if (!visitRow) throw new Error('Visit runtime instance not found.')

  const visit = mapVisitInstanceWithLock(visitRow as Record<string, unknown>)

  if (visit.lockStatus === LOCK_STATUS.LOCKED) {
    const existing = await loadExistingLockedSnapshot(
      args.supabase,
      args.organizationId,
      args.visitInstanceId,
    )
    if (!existing) {
      throw new Error('Visit is locked but snapshot record was not found.')
    }
    return { snapshot: existing, snapshotHash: existing.snapshotHash, idempotent: true }
  }

  if (visit.visitStatus !== VISIT_STATUS.COMPLETED) {
    throw new Error('Only completed visits can be locked.')
  }

  const workspace = await loadVisitWorkspace(args.supabase, args.organizationId, args.visitInstanceId)
  if (!workspace) throw new Error('Visit workspace not found.')

  if (!canCompleteVisit(workspace.procedureInstances)) {
    throw new Error('Required procedures must be terminal before visit can be locked.')
  }

  const snapshotJson = buildVisitSnapshot({
    visitInstance: visit,
    procedures: workspace.procedureInstances.map((procedure) => ({
      id: procedure.id,
      procedureCode: procedure.procedureCode,
      procedureName: procedure.procedureName,
      blueprintVersionId: procedure.blueprintVersionId,
      procedureStatus: procedure.procedureStatus,
      fieldValues: procedure.fieldValues,
      completedAt: procedure.completedAt,
      procedureOrder: procedure.procedureOrder,
    })),
    events: workspace.events,
  })

  const snapshotHash = computeVisitSnapshotHash(snapshotJson)
  const lockedAt = new Date().toISOString()
  const lockReason = args.lockReason?.trim() || null

  const { data: snapshotRow, error: snapshotError } = await args.supabase
    .from('visit_runtime_snapshots')
    .insert({
      organization_id: visit.organizationId,
      study_id: visit.studyId,
      subject_id: visit.subjectId,
      visit_instance_id: visit.id,
      source_package_id: visit.sourcePackageId,
      snapshot_status: 'locked',
      snapshot_json: snapshotJson,
      snapshot_hash: snapshotHash,
      locked_by: args.lockedBy,
      locked_at: lockedAt,
      lock_reason: lockReason,
      metadata: {},
    })
    .select('*')
    .single()

  if (snapshotError || !snapshotRow) {
    if (snapshotError?.code === '23505') {
      const existing = await loadExistingLockedSnapshot(
        args.supabase,
        args.organizationId,
        args.visitInstanceId,
      )
      if (existing) {
        return { snapshot: existing, snapshotHash: existing.snapshotHash, idempotent: true }
      }
    }
    throw new Error(`Failed to create visit snapshot: ${snapshotError?.message ?? 'Unknown error'}`)
  }

  const snapshot = mapVisitRuntimeSnapshotRow(snapshotRow as Record<string, unknown>)

  const { error: updateError } = await args.supabase
    .from('visit_runtime_instances')
    .update({
      lock_status: LOCK_STATUS.LOCKED,
      locked_snapshot_id: snapshot.id,
      locked_at: lockedAt,
      locked_by: args.lockedBy,
      updated_at: lockedAt,
    })
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)

  if (updateError) throw new Error(`Failed to lock visit instance: ${updateError.message}`)

  const stateSnapshot = buildStateSnapshot({
    visitInstanceId: visit.id,
    visitStatus: visit.visitStatus,
    progressPercent: visit.progressPercent,
    procedures: workspace.procedureInstances.map((procedure) => ({
      id: procedure.id,
      procedureStatus: procedure.procedureStatus,
      fieldValues: procedure.fieldValues,
    })),
  })

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: visit.organizationId,
    studyId: visit.studyId,
    subjectId: visit.subjectId,
    visitInstanceId: visit.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_SNAPSHOT_CREATED,
    actorId: args.lockedBy,
    eventPayload: {
      snapshot_id: snapshot.id,
      snapshot_hash: snapshotHash,
    },
    stateSnapshot,
  })

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: visit.organizationId,
    studyId: visit.studyId,
    subjectId: visit.subjectId,
    visitInstanceId: visit.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_LOCKED,
    actorId: args.lockedBy,
    eventPayload: {
      snapshot_id: snapshot.id,
      snapshot_hash: snapshotHash,
      lock_reason: lockReason,
    },
    stateSnapshot,
  })

  return { snapshot, snapshotHash, idempotent: false }
}
