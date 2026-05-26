import type { SupabaseClient } from '@supabase/supabase-js'
import { assertVisitUnlocked } from '@/lib/visit-runtime-locking/assert-visit-unlocked'
import { appendVisitRuntimeEvent, buildStateSnapshot } from './append-visit-runtime-event'
import { canCompleteVisit, getIncompleteRequiredProcedures } from './recalculate-visit-progress'
import { loadVisitInstanceProcedures } from './load-visit-workspace'
import {
  mapVisitRuntimeInstanceRow,
  VISIT_RUNTIME_EVENT_TYPE,
  VISIT_STATUS,
  type VisitRuntimeInstanceRow,
} from './visit-runtime-types'

export type CompleteVisitInstanceArgs = {
  supabase: SupabaseClient
  organizationId: string
  visitInstanceId: string
  actorId: string
}

export async function completeVisitInstance(
  args: CompleteVisitInstanceArgs,
): Promise<VisitRuntimeInstanceRow> {
  const { data: existing, error: loadError } = await args.supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Visit runtime instance not found.')

  await assertVisitUnlocked({
    supabase: args.supabase,
    organizationId: args.organizationId,
    visitInstanceId: args.visitInstanceId,
    actorId: args.actorId,
    mutation: 'complete_visit',
    recordLockAttempt: true,
  })

  if (existing.visit_status === VISIT_STATUS.COMPLETED) {
    return mapVisitRuntimeInstanceRow(existing as Record<string, unknown>)
  }
  if (existing.visit_status !== VISIT_STATUS.IN_PROGRESS) {
    throw new Error('Visit must be in progress before it can be completed.')
  }

  const procedures = await loadVisitInstanceProcedures(args.supabase, args.visitInstanceId)
  if (!canCompleteVisit(procedures)) {
    const incomplete = getIncompleteRequiredProcedures(procedures)
    throw new Error(
      `Required procedures must be completed or skipped before visit completion (${incomplete.length} remaining).`,
    )
  }

  const completedAt = new Date().toISOString()
  const progressPercent = 100

  const { data, error } = await args.supabase
    .from('visit_runtime_instances')
    .update({
      visit_status: VISIT_STATUS.COMPLETED,
      completed_at: completedAt,
      completed_by: args.actorId,
      progress_percent: progressPercent,
      updated_at: completedAt,
    })
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to complete visit: ${error?.message ?? 'Unknown error'}`)
  }

  const visitInstance = mapVisitRuntimeInstanceRow(data as Record<string, unknown>)

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: visitInstance.organizationId,
    studyId: visitInstance.studyId,
    subjectId: visitInstance.subjectId,
    visitInstanceId: visitInstance.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_COMPLETED,
    actorId: args.actorId,
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

  return visitInstance
}
