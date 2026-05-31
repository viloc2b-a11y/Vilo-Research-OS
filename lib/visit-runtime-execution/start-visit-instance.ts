import type { SupabaseClient } from '@supabase/supabase-js'
import { assertVisitUnlocked } from '@/lib/visit-runtime-locking/assert-visit-unlocked'
import { enforceConsentForVisitExecution } from '@/lib/subject/consent/enforcement'
import { appendVisitRuntimeEvent, buildStateSnapshot } from './append-visit-runtime-event'
import { loadVisitInstanceProcedures } from './load-visit-workspace'
import {
  mapVisitRuntimeInstanceRow,
  VISIT_RUNTIME_EVENT_TYPE,
  VISIT_STATUS,
  type VisitRuntimeInstanceRow,
} from './visit-runtime-types'

export type StartVisitInstanceArgs = {
  supabase: SupabaseClient
  organizationId: string
  visitInstanceId: string
  actorId: string
}

export async function startVisitInstance(
  args: StartVisitInstanceArgs,
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
    mutation: 'start_visit',
    recordLockAttempt: true,
  })

  if (existing.visit_status === VISIT_STATUS.COMPLETED) {
    throw new Error('Completed visits cannot be started again.')
  }
  if (existing.visit_status === VISIT_STATUS.IN_PROGRESS) {
    return mapVisitRuntimeInstanceRow(existing as Record<string, unknown>)
  }
  if (existing.visit_status !== VISIT_STATUS.NOT_STARTED) {
    throw new Error(`Visit cannot be started from status "${existing.visit_status}".`)
  }

  const consent = await enforceConsentForVisitExecution({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: existing.study_id as string,
    subjectId: existing.subject_id as string,
    visitId: args.visitInstanceId,
    actorUserId: args.actorId,
  })
  if (!consent.ok) throw new Error(consent.message)

  const startedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('visit_runtime_instances')
    .update({
      visit_status: VISIT_STATUS.IN_PROGRESS,
      started_at: startedAt,
      updated_at: startedAt,
    })
    .eq('id', args.visitInstanceId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to start visit: ${error?.message ?? 'Unknown error'}`)
  }

  const visitInstance = mapVisitRuntimeInstanceRow(data as Record<string, unknown>)
  const procedures = await loadVisitInstanceProcedures(args.supabase, args.visitInstanceId)

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: visitInstance.organizationId,
    studyId: visitInstance.studyId,
    subjectId: visitInstance.subjectId,
    visitInstanceId: visitInstance.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_STARTED,
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

async function assertVisitInProgress(
  supabase: SupabaseClient,
  organizationId: string,
  visitInstanceId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('visit_runtime_instances')
    .select('visit_status')
    .eq('id', visitInstanceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Visit runtime instance not found.')
  if (data.visit_status !== VISIT_STATUS.IN_PROGRESS) {
    throw new Error('Visit must be in progress before procedure execution changes.')
  }
}

export { assertVisitInProgress }
