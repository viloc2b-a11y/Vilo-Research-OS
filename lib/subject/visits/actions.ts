'use server'

import { revalidatePath } from 'next/cache'
import { completeVisit } from '@/lib/actions/complete-visit'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import type { SubjectVisitsActionResult } from '@/lib/subject/visits/types'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { createServerClient } from '@/lib/supabase/server'

const UUID_RE = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

async function assertVisitAccess(
  visitId: string,
  organizationId: string,
): Promise<{ ok: true; studyId: string; subjectId: string } | { ok: false; error: string }> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  const { data: visit, error } = await supabase
    .from('visits')
    .select('id, organization_id, study_id, study_subject_id')
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!visit) return { ok: false, error: 'Visit not found.' }

  return {
    ok: true,
    studyId: visit.study_id as string,
    subjectId: visit.study_subject_id as string,
  }
}

function visitsPaths(studyId: string, subjectId: string) {
  const base = `/studies/${studyId}/subjects/${subjectId}/visits`
  return [base, `/studies/${studyId}/subjects/${subjectId}`, `/subjects/${subjectId}`, `/visits`]
}

/** @deprecated Use rescheduleVisitAction from lib/visits/actions for window validation. */
export async function scheduleVisitAction(input: {
  visitId: string
  organizationId: string
  scheduledDate: string
  windowStart?: string | null
  windowEnd?: string | null
  outOfWindowReason?: string | null
}): Promise<SubjectVisitsActionResult> {
  const { rescheduleVisitAction } = await import('@/lib/visits/actions')
  return rescheduleVisitAction({
    visitId: input.visitId,
    organizationId: input.organizationId,
    scheduledDate: input.scheduledDate,
    outOfWindowReason: input.outOfWindowReason,
  })
}

export async function markVisitCompleteAction(input: {
  visitId: string
  organizationId: string
}): Promise<SubjectVisitsActionResult> {
  const { visitId, organizationId } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitAccess(visitId, organizationId)
  if (!access.ok) return access

  const visitPath = `/visits/${visitId}`
  const studyPath = `/studies/${access.studyId}`
  const subjectPath = `/studies/${access.studyId}/subjects/${access.subjectId}`

  const result = await completeVisit({
    visitId,
    visitPath,
    studyPath,
    subjectPath,
  })

  if (!result.ok) return { ok: false, error: result.message }
  for (const path of visitsPaths(access.studyId, access.subjectId)) {
    revalidatePath(path)
  }
  return { ok: true }
}

export async function addVisitNoteAction(input: {
  visitId: string
  organizationId: string
  note: string
}): Promise<SubjectVisitsActionResult> {
  const { visitId, organizationId, note } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitAccess(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('visits')
    .update({ coordinator_note: note.trim() || null })
    .eq('id', visitId)

  if (error) return { ok: false, error: error.message }

  await ClinicalMutationGateway.emitVisit({
    supabase,
    organizationId,
    studyId: access.studyId,
    visitId,
    actorUserId: user.id,
    eventType: OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
    payloadSource: 'subject-visits-actions',
    mutation: 'visits.coordinator_note',
    details: { coordinator_note: note.trim() || null },
  })

  for (const path of visitsPaths(access.studyId, access.subjectId)) {
    revalidatePath(path)
  }
  return { ok: true }
}
