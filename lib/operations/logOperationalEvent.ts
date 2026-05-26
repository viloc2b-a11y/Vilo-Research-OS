import type { OperationalEventType } from '@/lib/operations/event-types'
import { appendOperationalEvent } from '@/lib/operational-events'
import type { EmitContext } from '@/lib/operational-events'
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
  occurredAt?: string | Date | null
  emitContext?: EmitContext
}

export async function logOperationalEvent(
  input: LogOperationalEventInput,
): Promise<string | null> {
  const appended = await appendOperationalEvent(
    {
      domainEvent: {
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: input.visitId ?? null,
        procedureExecutionId: input.procedureExecutionId ?? null,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        occurredAt: input.occurredAt
          ? input.occurredAt instanceof Date
            ? input.occurredAt
            : new Date(input.occurredAt)
          : undefined,
        payload: input.payload ?? {},
      },
      context: input.emitContext,
      mirrorToPublic: true,
    },
    { supabase: input.supabase },
  )

  return appended.eventId
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
