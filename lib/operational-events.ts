import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export type EmitContext = {
  trigger?: string
  source?: string
  correlationId?: string
  idempotencyKey?: string
}

export type DomainEventParams = {
  organizationId: string
  studyId: string
  visitId: string | null
  procedureExecutionId: string | null
  eventType: string
  actorUserId: string | null
  occurredAt?: Date
  payload: Record<string, unknown>
}

export async function appendOperationalEvent(
  input: {
    domainEvent: DomainEventParams
    context?: EmitContext
    mirrorToPublic?: boolean
  },
  deps: { supabase: Supabase }
): Promise<{ eventId: string | null }> {
  const { data, error } = await deps.supabase
    .from('operational_events')
    .insert({
      organization_id: input.domainEvent.organizationId,
      study_id: input.domainEvent.studyId,
      visit_id: input.domainEvent.visitId,
      procedure_execution_id: input.domainEvent.procedureExecutionId,
      event_type: input.domainEvent.eventType,
      actor_user_id: input.domainEvent.actorUserId,
      payload: input.domainEvent.payload,
      occurred_at: input.domainEvent.occurredAt?.toISOString()
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { eventId: data?.id ?? null }
}
