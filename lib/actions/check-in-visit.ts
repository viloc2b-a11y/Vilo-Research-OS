'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import type { VisitLifecycleResult } from '@/lib/actions/visit-lifecycle.types'
import { mapRuntimeDbErrorToCoordinatorMessage } from '@/lib/concurrency/db-errors'

const UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

/**
 * F-01 fix — transitions a visit from scheduled → checked_in.
 * Only applies to visits in 'scheduled' status; idempotent for already-active visits.
 */
export async function checkInVisit(input: {
  visitId: string
  visitPath: string
  studyPath: string
  subjectPath: string
}): Promise<VisitLifecycleResult> {
  const { visitId, visitPath, studyPath, subjectPath } = input

  if (!UUID_REGEX.test(visitId)) {
    return { ok: false, message: 'Invalid visit id.' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user?.id) {
    return { ok: false, message: 'Authentication required.' }
  }

  // Read current status — idempotent guard
  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select('id, organization_id, study_id, visit_status')
    .eq('id', visitId)
    .maybeSingle()

  if (visitErr) {
    return { ok: false, message: mapRuntimeDbErrorToCoordinatorMessage(visitErr, 'Could not load visit.') }
  }
  if (!visit) return { ok: false, message: 'Visit not found.' }

  const currentStatus = visit.visit_status as string | null

  // Already in an active or terminal state — idempotent
  if (
    currentStatus === 'checked_in' ||
    currentStatus === 'in_progress' ||
    currentStatus === 'completed' ||
    currentStatus === 'locked'
  ) {
    return { ok: true, idempotent: true }
  }

  if (currentStatus !== 'scheduled') {
    return {
      ok: false,
      message: `Visit cannot be checked in from status «${currentStatus ?? 'unknown'}».`,
    }
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateErr } = await supabase
    .from('visits')
    .update({
      visit_status: 'checked_in',
      checked_in_at: now,
    })
    .eq('id', visitId)
    .eq('organization_id', visit.organization_id as string)
    .eq('visit_status', 'scheduled')
    .select('id')
    .maybeSingle()

  if (updateErr) {
    // Column may not exist yet on older schemas — fall back gracefully
    if (/checked_in_at/i.test(updateErr.message)) {
      const { data: fallbackRow, error: fallbackErr } = await supabase
        .from('visits')
        .update({ visit_status: 'checked_in' })
        .eq('id', visitId)
        .eq('organization_id', visit.organization_id as string)
        .eq('visit_status', 'scheduled')
        .select('id')
        .maybeSingle()
      if (fallbackErr) return { ok: false, message: mapRuntimeDbErrorToCoordinatorMessage(fallbackErr, fallbackErr.message) }
      if (!fallbackRow) {
        return {
          ok: false,
          message: 'Visit status changed — refresh the page before checking in.',
        }
      }
    } else {
      return { ok: false, message: mapRuntimeDbErrorToCoordinatorMessage(updateErr, updateErr.message) }
    }
  } else if (!updated) {
    return {
      ok: false,
      message: 'Visit status changed — refresh the page before checking in.',
    }
  }

  await ClinicalMutationGateway.emitVisit({
    supabase,
    organizationId: visit.organization_id as string,
    studyId: visit.study_id as string,
    visitId,
    actorUserId: user.id,
    eventType: OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN,
    payloadSource: 'check-in-visit',
    mutation: 'visits.check_in',
    details: {
      previous_status: currentStatus,
      visit_status: 'checked_in',
      checked_in_at: now,
    },
  })

  void logAuditEvent({
    organizationId: visit.organization_id as string,
    actorUserId: user.id,
    action: 'VISIT_CHECKED_IN',
    target: visitId,
    metadata: { study_id: visit.study_id },
  })

  revalidatePath(visitPath)
  revalidatePath(studyPath)
  revalidatePath(subjectPath)
  revalidatePath('/studies')

  return { ok: true }
}
