import type { OperationalEventType } from '@/lib/operations/event-types'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export type LogOperationalEventInput = {
  supabase: Supabase
  organizationId: string
  studyId: string
  eventType: OperationalEventType | string
  actorUserId: string | null
  payload?: Record<string, unknown>
  visitId?: string | null
  procedureExecutionId?: string | null
}

export async function logOperationalEvent(input: LogOperationalEventInput) {
  const { error } = await input.supabase.from('operational_events').insert({
    organization_id: input.organizationId,
    study_id: input.studyId,
    visit_id: input.visitId ?? null,
    procedure_execution_id: input.procedureExecutionId ?? null,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    payload: input.payload ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function logProcedureOperationalEvent(params: {
  supabase: Supabase
  procedure: {
    id: string
    organization_id: string
    study_id: string
    visit_id: string
  }
  actorUserId: string
  eventType: OperationalEventType | string
  payload?: Record<string, unknown>
}) {
  await logOperationalEvent({
    supabase: params.supabase,
    organizationId: params.procedure.organization_id,
    studyId: params.procedure.study_id,
    visitId: params.procedure.visit_id,
    procedureExecutionId: params.procedure.id,
    actorUserId: params.actorUserId,
    eventType: params.eventType,
    payload: params.payload,
  })
}

export async function logVisitOperationalEvent(params: {
  supabase: Supabase
  organizationId: string
  studyId: string
  visitId: string
  actorUserId: string
  eventType: OperationalEventType | string
  payload?: Record<string, unknown>
}) {
  await logOperationalEvent({
    supabase: params.supabase,
    organizationId: params.organizationId,
    studyId: params.studyId,
    visitId: params.visitId,
    actorUserId: params.actorUserId,
    eventType: params.eventType,
    payload: params.payload,
  })
}
