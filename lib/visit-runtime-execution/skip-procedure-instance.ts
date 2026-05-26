import type { SupabaseClient } from '@supabase/supabase-js'
import { assertVisitUnlockedForProcedure } from '@/lib/visit-runtime-locking/assert-visit-unlocked'
import { appendVisitRuntimeEvent, buildStateSnapshot } from './append-visit-runtime-event'
import { loadProcedureInstance, loadVisitInstanceProcedures } from './load-visit-workspace'
import { assertVisitInProgress } from './start-visit-instance'
import { syncVisitProgress } from './update-visit-progress'
import {
  mapProcedureRuntimeInstanceRow,
  PROCEDURE_STATUS,
  VISIT_RUNTIME_EVENT_TYPE,
  type ProcedureRuntimeInstanceRow,
} from './visit-runtime-types'

export type SkipProcedureInstanceArgs = {
  supabase: SupabaseClient
  organizationId: string
  procedureInstanceId: string
  actorId: string
  reason?: string
}

export async function skipProcedureInstance(
  args: SkipProcedureInstanceArgs,
): Promise<ProcedureRuntimeInstanceRow> {
  const existing = await loadProcedureInstance(
    args.supabase,
    args.organizationId,
    args.procedureInstanceId,
  )
  if (!existing) throw new Error('Procedure runtime instance not found.')

  await assertVisitUnlockedForProcedure(
    args.supabase,
    args.organizationId,
    args.procedureInstanceId,
    args.actorId,
    'skip_procedure',
  )

  await assertVisitInProgress(args.supabase, args.organizationId, existing.visitInstanceId)

  if (existing.required && !args.reason?.trim()) {
    throw new Error('A skip reason is required for required procedures.')
  }
  if (existing.procedureStatus === PROCEDURE_STATUS.SKIPPED) {
    return existing
  }
  if (existing.procedureStatus === PROCEDURE_STATUS.COMPLETED) {
    throw new Error('Completed procedures cannot be skipped.')
  }

  const now = new Date().toISOString()
  const metadata = {
    ...existing.metadata,
    ...(args.reason?.trim() ? { skip_reason: args.reason.trim() } : {}),
  }

  const { data, error } = await args.supabase
    .from('procedure_runtime_instances')
    .update({
      procedure_status: PROCEDURE_STATUS.SKIPPED,
      completed_at: now,
      completed_by: args.actorId,
      metadata,
      updated_at: now,
    })
    .eq('id', args.procedureInstanceId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to skip procedure: ${error?.message ?? 'Unknown error'}`)
  }

  const procedureInstance = mapProcedureRuntimeInstanceRow(data as Record<string, unknown>)
  const visitInstance = await syncVisitProgress(
    args.supabase,
    args.organizationId,
    existing.visitInstanceId,
  )
  const procedures = await loadVisitInstanceProcedures(args.supabase, existing.visitInstanceId)

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: procedureInstance.organizationId,
    studyId: procedureInstance.studyId,
    subjectId: procedureInstance.subjectId,
    visitInstanceId: procedureInstance.visitInstanceId,
    procedureInstanceId: procedureInstance.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.PROCEDURE_SKIPPED,
    actorId: args.actorId,
    eventPayload: { reason: args.reason?.trim() ?? null, required: existing.required },
    stateSnapshot: buildStateSnapshot({
      visitInstanceId: visitInstance.id,
      visitStatus: visitInstance.visitStatus,
      progressPercent: visitInstance.progressPercent,
      procedures: procedures.map((procedure) => ({
        id: procedure.id,
        procedureStatus: procedure.procedureStatus,
        fieldValues: procedure.fieldValues,
      })),
    }),
  })

  return procedureInstance
}
