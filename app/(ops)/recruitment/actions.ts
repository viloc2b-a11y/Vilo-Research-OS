'use server'

import { redirect } from 'next/navigation'
import {
  assignLeadStudyAction,
  convertLeadToSubjectAction,
  logLeadContactAttemptAction,
  qualifyLeadAction,
  scheduleLeadFollowUpAction,
  type ActionResult,
} from '@/lib/crm/recruitment-actions'

type ContactAttemptType = 'call' | 'sms' | 'email'
type ContactOutcome = 'reached' | 'no_answer' | 'voicemail' | 'wrong_number' | 'opted_out' | 'rescheduled' | 'other'

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = requiredString(formData, key)
  return value || undefined
}

function redirectWithResult<T>(result: ActionResult<T>, success: string): never {
  if (result.ok) {
    redirect(`/recruitment?result=success&reason=${encodeURIComponent(success)}`)
  }

  redirect(`/recruitment?result=error&reason=${encodeURIComponent(result.error)}`)
}

function toIsoFromDatetimeLocal(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

export async function submitRecruitmentContactAttempt(formData: FormData) {
  const leadId = requiredString(formData, 'leadId')
  const organizationId = requiredString(formData, 'organizationId')
  const attemptType = requiredString(formData, 'attemptType') as ContactAttemptType
  const outcome = requiredString(formData, 'outcome') as ContactOutcome
  const notes = optionalString(formData, 'notes')

  if (!leadId || !organizationId || !attemptType || !outcome) {
    redirect('/recruitment?result=error&reason=CONTACT_ATTEMPT_REQUIRED_FIELDS')
  }

  const result = await logLeadContactAttemptAction(leadId, {
    attempt_type: attemptType,
    outcome,
    notes,
    organizationId,
  })

  redirectWithResult(result, 'Contact attempt logged.')
}

export async function submitRecruitmentFollowUp(formData: FormData) {
  const leadId = requiredString(formData, 'leadId')
  const organizationId = requiredString(formData, 'organizationId')
  const nextFollowUpAt = requiredString(formData, 'nextFollowUpAt')

  if (!leadId || !organizationId || !nextFollowUpAt) {
    redirect('/recruitment?result=error&reason=FOLLOW_UP_REQUIRED_FIELDS')
  }

  const result = await scheduleLeadFollowUpAction(
    leadId,
    toIsoFromDatetimeLocal(nextFollowUpAt),
    organizationId,
  )

  redirectWithResult(result, 'Follow-up scheduled.')
}

export async function submitRecruitmentQualify(formData: FormData) {
  const leadId = requiredString(formData, 'leadId')
  const organizationId = requiredString(formData, 'organizationId')
  const nextFollowUpAt = optionalString(formData, 'nextFollowUpAt')

  if (!leadId || !organizationId) {
    redirect('/recruitment?result=error&reason=QUALIFY_REQUIRED_FIELDS')
  }

  const result = await qualifyLeadAction(
    leadId,
    nextFollowUpAt ? toIsoFromDatetimeLocal(nextFollowUpAt) : undefined,
    organizationId,
  )

  redirectWithResult(result, 'Lead qualified.')
}

export async function submitRecruitmentStudyAssignment(formData: FormData) {
  const leadId = requiredString(formData, 'leadId')
  const organizationId = requiredString(formData, 'organizationId')
  const studyId = requiredString(formData, 'studyId')
  const markPrimary = formData.get('markPrimary') === 'on'

  if (!leadId || !organizationId || !studyId) {
    redirect('/recruitment?result=error&reason=STUDY_ASSIGNMENT_REQUIRED_FIELDS')
  }

  const result = await assignLeadStudyAction(leadId, studyId, markPrimary, organizationId)

  redirectWithResult(result, 'Study assigned.')
}

export async function submitRecruitmentLeadConversion(formData: FormData) {
  const leadId = requiredString(formData, 'leadId')
  const organizationId = requiredString(formData, 'organizationId')
  const studySubjectId = requiredString(formData, 'studySubjectId')

  if (!leadId || !organizationId || !studySubjectId) {
    redirect('/recruitment?result=error&reason=CONVERSION_REQUIRED_FIELDS')
  }

  const result = await convertLeadToSubjectAction(leadId, studySubjectId, organizationId)

  redirectWithResult(result, 'Lead converted to subject.')
}

