import { randomUUID } from 'node:crypto'
import { authorizeRuntimeCommand } from '@/lib/authorization/guards/authorize-command'
import type { OrganizationMembership } from '@/lib/auth/session'
import { zonedLocalDateTimeToUtcIso, getSiteTimeZone } from '@/lib/calendar/site-calendar-dates'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { createServerClient } from '@/lib/supabase/server'
import type { ApiV1ManualOperationalEntryResult } from '../../../packages/contracts/src/api/v1/commands/manual-operational-entry'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export type CreateManualOperationalEntryInput = {
  organizationId: string
  studyId: string
  siteCalendarDate: string
  manualEventType: string
  title: string
  studySubjectId?: string | null
  visitId?: string | null
  eventTime?: string | null
  notes?: string | null
  actorUserId: string
  memberships: OrganizationMembership[]
  idempotencyKey?: string | null
  correlationId?: string | null
}

export type CreateManualOperationalEntryResult =
  | { ok: true; entry: ApiV1ManualOperationalEntryResult; idempotentReplay?: boolean }
  | { ok: false; message: string; code?: string }

export async function createManualOperationalEntry(
  input: CreateManualOperationalEntryInput,
  deps: { supabase: Supabase },
): Promise<CreateManualOperationalEntryResult> {
  const auth = await authorizeRuntimeCommand({
    command: 'manual_operational_entry.create',
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    memberships: input.memberships,
    targetId: input.studyId,
    invocationSurface: 'api',
  })
  if (!auth.ok) {
    return { ok: false, message: auth.message, code: auth.code }
  }

  if (input.visitId) {
    const { data: visit } = await deps.supabase
      .from('visits')
      .select('id')
      .eq('id', input.visitId)
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .maybeSingle()
    if (!visit) return { ok: false, message: 'Visit not found for manual operational entry.' }
  }

  const occurredAt = zonedLocalDateTimeToUtcIso(
    input.siteCalendarDate,
    input.eventTime ?? '12:00',
    getSiteTimeZone(),
  )

  let entryId: string
  try {
    entryId = await logOperationalEvent({
      supabase: deps.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId ?? null,
      eventType: 'OPERATIONAL_CALENDAR_MANUAL_EVENT',
      actorUserId: input.actorUserId,
      occurredAt,
      emitContext: {
        idempotencyKey: input.idempotencyKey ?? undefined,
        correlationId: input.correlationId ?? undefined,
      },
      payload: {
        calendar_event_type: 'manual',
        manual_event_type: input.manualEventType,
        title: input.title,
        event_date: input.siteCalendarDate,
        event_time: input.eventTime ?? null,
        site_time_zone: getSiteTimeZone(),
        study_id: input.studyId,
        subject_id: input.studySubjectId ?? null,
        visit_id: input.visitId ?? null,
        notes: input.notes ?? null,
        source: 'api_v1_runtime',
        idempotency_key: input.idempotencyKey ?? null,
        correlation_id: input.correlationId ?? null,
        guardrail: 'manual_event_does_not_overwrite_protocol_schedule',
      },
    }) ?? randomUUID()
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not create manual operational entry.' }
  }

  return {
    ok: true,
    entry: {
      entryId,
      manualEventType: input.manualEventType,
      siteCalendarDate: input.siteCalendarDate,
      status: 'active',
    },
  }
}
