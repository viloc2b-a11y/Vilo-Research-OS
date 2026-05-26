import type { SupabaseClient } from '@supabase/supabase-js'
import { appendVisitRuntimeEvent, buildStateSnapshot } from '@/lib/visit-runtime-execution/append-visit-runtime-event'
import { loadVisitInstanceProcedures } from '@/lib/visit-runtime-execution/load-visit-workspace'
import { VISIT_RUNTIME_EVENT_TYPE } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { LOCK_STATUS, mapVisitInstanceWithLock } from './visit-locking-types'

export class VisitLockedError extends Error {
  constructor(message = 'Visit is locked and cannot be modified.') {
    super(message)
    this.name = 'VisitLockedError'
  }
}

export type AssertVisitUnlockedArgs = {
  supabase: SupabaseClient
  organizationId: string
  visitInstanceId: string
  actorId?: string
  mutation?: string
  recordLockAttempt?: boolean
}

export async function assertVisitUnlocked(args: AssertVisitUnlockedArgs): Promise<void> {
  const { data, error } = await args.supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Visit runtime instance not found.')

  const visit = mapVisitInstanceWithLock(data as Record<string, unknown>)
  if (visit.lockStatus !== LOCK_STATUS.LOCKED) return

  if (args.recordLockAttempt && args.actorId) {
    const procedures = await loadVisitInstanceProcedures(args.supabase, args.visitInstanceId)
    await appendVisitRuntimeEvent({
      supabase: args.supabase,
      organizationId: visit.organizationId,
      studyId: visit.studyId,
      subjectId: visit.subjectId,
      visitInstanceId: visit.id,
      eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_LOCK_ATTEMPT_FAILED,
      actorId: args.actorId,
      eventPayload: {
        mutation: args.mutation ?? 'unknown',
        lock_status: visit.lockStatus,
        locked_snapshot_id: visit.lockedSnapshotId,
      },
      stateSnapshot: buildStateSnapshot({
        visitInstanceId: visit.id,
        visitStatus: visit.visitStatus,
        progressPercent: visit.progressPercent,
        procedures: procedures.map((procedure) => ({
          id: procedure.id,
          procedureStatus: procedure.procedureStatus,
          fieldValues: procedure.fieldValues,
        })),
      }),
    })
  }

  throw new VisitLockedError()
}

export async function assertVisitUnlockedForProcedure(
  supabase: SupabaseClient,
  organizationId: string,
  procedureInstanceId: string,
  actorId: string,
  mutation: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('procedure_runtime_instances')
    .select('visit_instance_id')
    .eq('id', procedureInstanceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Procedure runtime instance not found.')

  const visitInstanceId = String(data.visit_instance_id)
  await assertVisitUnlocked({
    supabase,
    organizationId,
    visitInstanceId,
    actorId,
    mutation,
    recordLockAttempt: true,
  })
  return visitInstanceId
}
