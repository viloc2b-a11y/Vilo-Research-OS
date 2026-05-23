'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { generateSubjectVisitSchedule } from '@/lib/visits/generateSubjectVisitSchedule'
import { rescheduleVisit } from '@/lib/visits/rescheduleVisit'
import type { SubjectVisitsActionResult } from '@/lib/subject/visits/types'
import { createServerClient } from '@/lib/supabase/server'

const UUID_RE = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function revalidateVisitPaths(studyId: string, subjectId: string, visitId: string) {
  const paths = [
    `/studies/${studyId}/subjects/${subjectId}/visits`,
    `/studies/${studyId}/subjects/${subjectId}`,
    `/subjects/${subjectId}`,
    `/visits/${visitId}`,
    '/',
  ]
  for (const path of paths) {
    revalidatePath(path)
  }
}

export async function rescheduleVisitAction(input: {
  visitId: string
  organizationId: string
  scheduledDate: string
  outOfWindowReason?: string | null
}): Promise<SubjectVisitsActionResult> {
  const { visitId, organizationId, scheduledDate, outOfWindowReason } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }
  if (!DATE_RE.test(scheduledDate)) {
    return { ok: false, error: 'Scheduled date must be YYYY-MM-DD.' }
  }

  const access = await assertVisitAccess(visitId, organizationId)
  if (!access.ok) return access

  const supabase = await createServerClient()
  const result = await rescheduleVisit({
    supabase,
    visitId,
    organizationId,
    scheduledDate,
    outOfWindowReason,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}

export async function sendVisitReminderAction(input: {
  visitId: string
  organizationId: string
  reminderType: 'sms' | 'phone'
  notes?: string | null
}): Promise<SubjectVisitsActionResult> {
  const { visitId, organizationId, reminderType, notes } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }
  if (reminderType !== 'sms' && reminderType !== 'phone') {
    return { ok: false, error: 'Invalid reminder type.' }
  }

  const access = await assertVisitAccess(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { error: reminderErr } = await supabase.from('visit_reminders').insert({
    organization_id: organizationId,
    visit_id: visitId,
    reminder_type: reminderType,
    sent_by: user.id,
    sent_at: now,
    notes: notes?.trim() || null,
  })

  if (reminderErr) return { ok: false, error: reminderErr.message }

  const visitPatch =
    reminderType === 'sms'
      ? {
          sms_reminder_sent_at: now,
          confirmation_status: 'reminder_sent',
        }
      : {
          phone_reminder_logged_at: now,
          confirmation_status: 'reminder_sent',
        }

  const { error: visitErr } = await supabase
    .from('visits')
    .update(visitPatch)
    .eq('id', visitId)

  if (visitErr) return { ok: false, error: visitErr.message }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  revalidatePath('/')
  return { ok: true }
}

export async function generateSubjectVisitScheduleAction(input: {
  studySubjectId: string
  organizationId: string
  anchorDate?: string | null
  expectedUpdatedAt?: string | null
}): Promise<SubjectVisitsActionResult & { createdCount?: number }> {
  const { studySubjectId, organizationId, anchorDate, expectedUpdatedAt } = input
  if (!UUID_RE.test(studySubjectId)) {
    return { ok: false, error: 'Invalid subject id.' }
  }
  if (anchorDate && !DATE_RE.test(anchorDate)) {
    return { ok: false, error: 'Anchor date must be YYYY-MM-DD.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  const { data: subject } = await supabase
    .from('study_subjects')
    .select('id, study_id, updated_at')
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!subject) return { ok: false, error: 'Subject not found.' }

  if (expectedUpdatedAt && subject.updated_at !== expectedUpdatedAt) {
    return { ok: false, error: 'This subject has already been enrolled or randomized. Please refresh.' }
  }

  const result = await generateSubjectVisitSchedule({
    supabase,
    studySubjectId,
    anchorDate: anchorDate ?? undefined,
    force: false,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath(`/studies/${subject.study_id}/subjects/${studySubjectId}/visits`)
  revalidatePath(`/studies/${subject.study_id}/subjects/${studySubjectId}`)
  revalidatePath('/')

  return { ok: true, createdCount: result.createdCount }
}
