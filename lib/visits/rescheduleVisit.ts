import { getSessionUser } from '@/lib/auth/session'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import { validateVisitWindow } from '@/lib/visits/validateVisitWindow'
import type { RescheduleVisitResult } from '@/lib/visits/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function rescheduleVisit(input: {
  supabase: SupabaseClient
  visitId: string
  organizationId: string
  scheduledDate: string
  outOfWindowReason?: string | null
}): Promise<RescheduleVisitResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const { data: visit, error: loadErr } = await input.supabase
    .from('visits')
    .select(
      'id, organization_id, study_id, study_subject_id, visit_status, scheduled_date, target_date, window_start, window_end, actual_date, completed_at',
    )
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (loadErr) return { ok: false, error: loadErr.message }
  if (!visit) return { ok: false, error: 'Visit not found.' }

  const windowStart = (visit.window_start as string | null) ?? (visit.target_date as string)
  const windowEnd = (visit.window_end as string | null) ?? (visit.target_date as string)
  if (!windowStart || !windowEnd) {
    return { ok: false, error: 'Visit protocol window is not configured.' }
  }

  const validation = validateVisitWindow({
    scheduledDate: input.scheduledDate,
    targetDate: (visit.target_date as string | null) ?? null,
    windowStartDate: windowStart,
    windowEndDate: windowEnd,
  })

  if (validation.isOutsideWindow) {
    const reason = input.outOfWindowReason?.trim()
    if (!reason) {
      return {
        ok: false,
        error: 'A reason is required when scheduling outside the protocol window.',
      }
    }
  }

  const refreshed = refreshVisitOperationalFields({
    visitStatus: visit.visit_status as string,
    scheduledDate: input.scheduledDate,
    targetDate: (visit.target_date as string | null) ?? null,
    windowStartDate: windowStart,
    windowEndDate: windowEnd,
    actualDate: (visit.actual_date as string | null) ?? null,
    completedAt: visit.completed_at ? String(visit.completed_at) : null,
  })

  const visitStatus =
    validation.isOutsideWindow && !['completed', 'cancelled', 'locked'].includes(visit.visit_status as string)
      ? 'out_of_window'
      : refreshed.visitStatus

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    scheduled_date: input.scheduledDate,
    window_status: validation.windowStatus,
    visit_status: visitStatus,
    confirmation_status: 'confirmed',
    rescheduled_at: now,
    rescheduled_by: user.id,
  }

  if (validation.isOutsideWindow && input.outOfWindowReason?.trim()) {
    patch.out_of_window_reason = input.outOfWindowReason.trim()
    patch.out_of_window_override_at = now
    patch.out_of_window_override_by = user.id
  } else if (!validation.isOutsideWindow) {
    patch.out_of_window_reason = null
  }

  const { error: updateErr } = await input.supabase
    .from('visits')
    .update(patch)
    .eq('id', input.visitId)

  if (updateErr) return { ok: false, error: updateErr.message }

  await ClinicalMutationGateway.emitVisit({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: visit.study_id as string,
    visitId: input.visitId,
    actorUserId: user.id,
    eventType: OPERATIONAL_EVENT_TYPES.VISIT_RESCHEDULED,
    payloadSource: 'reschedule-visit',
    mutation: 'visits.reschedule',
    subjectId: (visit.study_subject_id as string | null) ?? null,
    details: {
      previous_scheduled_date: visit.scheduled_date,
      scheduled_date: input.scheduledDate,
      previous_visit_status: visit.visit_status,
      visit_status: visitStatus,
      window_status: validation.windowStatus,
      is_outside_window: validation.isOutsideWindow,
      out_of_window_reason: input.outOfWindowReason?.trim() || null,
      reschedule_channel: 'direct',
    },
  })

  return {
    ok: true,
    windowStatus: validation.windowStatus,
    visitStatus,
  }
}
