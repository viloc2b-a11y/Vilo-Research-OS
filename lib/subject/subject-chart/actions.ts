'use server'

import { revalidatePath } from 'next/cache'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

const STATUS_VALUES = new Set([
  'screening',
  'screen_failed',
  'enrolled',
  'randomized',
  'completed',
  'withdrawn',
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type SubjectGeneralActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_SUBJECT_GENERAL_STATE: SubjectGeneralActionState = {
  ok: false,
  message: null,
}

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

function subjectPath(subjectId: string) {
  return `/subjects/${subjectId}`
}

export async function updateSubjectGeneralAction(
  _prev: SubjectGeneralActionState,
  formData: FormData,
): Promise<SubjectGeneralActionState> {
  const subjectId = clean(formData.get('subject_id'))
  const organizationId = clean(formData.get('organization_id'))
  const subjectNumber = clean(formData.get('subject_number'))
  const status = clean(formData.get('status'))
  const dateOfBirth = clean(formData.get('date_of_birth'))

  if (!subjectId || !organizationId) {
    return { ok: false, message: 'Missing subject or organization context.' }
  }
  if (!subjectNumber) {
    return { ok: false, message: 'Subject number is required.' }
  }
  if (!status || !STATUS_VALUES.has(status)) {
    return { ok: false, message: 'Status is not valid.' }
  }
  if (dateOfBirth && !DATE_RE.test(dateOfBirth)) {
    return { ok: false, message: 'Date of birth must use YYYY-MM-DD.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!memberships.some((m) => m.organization_id === organizationId)) {
    return { ok: false, message: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, enrollment_status')
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subjectError) return { ok: false, message: subjectError.message }
  if (!subject) return { ok: false, message: 'Subject not found in this organization.' }

  const { error } = await supabase
    .from('study_subjects')
    .update({
      subject_identifier: subjectNumber,
      randomization_number: clean(formData.get('randomization_number')),
      randomization_arm: clean(formData.get('study_arm')),
      enrollment_status: status,
      first_name: clean(formData.get('first_name')),
      middle_initial: clean(formData.get('middle_initial')),
      last_name: clean(formData.get('last_name')),
      initials: clean(formData.get('initials')),
      gender: clean(formData.get('gender')),
      date_of_birth: dateOfBirth,
    })
    .eq('id', subjectId)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, message: error.message }

  const prevStatus = subject.enrollment_status as string
  if (
    (status === 'enrolled' || status === 'randomized') &&
    prevStatus !== status
  ) {
    const { generateSubjectVisitSchedule } = await import(
      '@/lib/visits/generateSubjectVisitSchedule'
    )
    const scheduleResult = await generateSubjectVisitSchedule({
      supabase,
      studySubjectId: subjectId,
    })
    if (!scheduleResult.ok) {
      return {
        ok: true,
        message: `Subject profile saved. Visit schedule: ${scheduleResult.error}`,
      }
    }
    if (scheduleResult.createdCount > 0) {
      revalidatePath(`/studies/${subject.study_id}/subjects/${subjectId}/visits`)
    }
  }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject profile saved.' }
}
