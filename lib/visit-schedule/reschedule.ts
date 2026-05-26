import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { LogOperationalEventInput } from '@/lib/operations/logOperationalEvent'
import type { ResolvedProtocolVisitReschedule } from '@/lib/visit-schedule/resolve-protocol-visit-reschedules'

type Supabase = LogOperationalEventInput['supabase']

export type ScheduledVisitForReschedule = {
  id: string
  organization_id: string
  study_id: string
  subject_id: string
  visit_definition_id: string
  visit_id: string | null
  ideal_date: string
  assigned_user_id: string | null
}

export type RequestVisitRescheduleInput = {
  supabase: Supabase
  scheduledVisit: ScheduledVisitForReschedule
  actorUserId: string
  rescheduledDate: string
  rescheduledTime: string | null
  assignedUserId: string | null
  reason: string | null
  notes: string | null
}

export type CancelVisitRescheduleInput = {
  supabase: Supabase
  scheduledVisit: ScheduledVisitForReschedule
  actorUserId: string
  cancelReason: string | null
}

export type VisitRescheduleResult = {
  eventId: string | null
  reschedule: ResolvedProtocolVisitReschedule
}

export async function requestVisitReschedule(
  input: RequestVisitRescheduleInput,
): Promise<VisitRescheduleResult> {
  const scheduled = input.scheduledVisit
  const assignedUserId = input.assignedUserId ?? scheduled.assigned_user_id
  const eventId = await logOperationalEvent({
    supabase: input.supabase,
    organizationId: scheduled.organization_id,
    studyId: scheduled.study_id,
    visitId: scheduled.visit_id,
    eventType: 'protocol_visit_rescheduled',
    actorUserId: input.actorUserId,
    occurredAt: new Date(),
    payload: {
      calendar_event_type: 'protocol_visit_reschedule',
      blinding_scope: 'public_to_site',
      scheduled_visit_id: scheduled.id,
      visit_id: scheduled.visit_id,
      study_id: scheduled.study_id,
      subject_id: scheduled.subject_id,
      visit_definition_id: scheduled.visit_definition_id,
      original_target_date: scheduled.ideal_date,
      rescheduled_date: input.rescheduledDate,
      rescheduled_time: input.rescheduledTime,
      assigned_user_id: assignedUserId,
      reason: input.reason,
      notes: input.notes,
      source: 'operational_calendar',
      guardrail: 'does_not_overwrite_protocol_target_date',
    },
  })

  return {
    eventId,
    reschedule: {
      scheduledVisitId: scheduled.id,
      visitId: scheduled.visit_id,
      studyId: scheduled.study_id,
      subjectId: scheduled.subject_id,
      visitDefinitionId: scheduled.visit_definition_id,
      originalTargetDate: scheduled.ideal_date,
      rescheduledDate: input.rescheduledDate,
      rescheduledTime: input.rescheduledTime,
      assignedUserId,
      reason: input.reason,
      notes: input.notes,
    },
  }
}

export async function cancelVisitReschedule(
  input: CancelVisitRescheduleInput,
): Promise<{ eventId: string | null }> {
  const scheduled = input.scheduledVisit
  const occurredAt = new Date()
  const eventId = await logOperationalEvent({
    supabase: input.supabase,
    organizationId: scheduled.organization_id,
    studyId: scheduled.study_id,
    visitId: scheduled.visit_id,
    eventType: 'protocol_visit_reschedule_cancelled',
    actorUserId: input.actorUserId,
    occurredAt,
    payload: {
      calendar_event_type: 'protocol_visit_reschedule',
      blinding_scope: 'public_to_site',
      scheduled_visit_id: scheduled.id,
      visit_id: scheduled.visit_id,
      cancelled_at: occurredAt.toISOString(),
      cancel_reason: input.cancelReason,
      source: 'operational_calendar',
    },
  })

  return { eventId }
}
