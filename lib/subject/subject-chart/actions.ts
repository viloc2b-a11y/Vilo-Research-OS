'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  canManageUnblindedData,
  canMutateOrganizationData,
} from '@/lib/rbac/permissions'
import {
  canExecuteStudyRuntime,
  formatStudyRuntimeBlockers,
} from '@/lib/studies/runtime-readiness'
import { STALE_WRITE_USER_MESSAGE } from '@/lib/concurrency/stale-write'
import { resolveSubjectProtocolFields } from '@/lib/subject/subject-protocol-fields'
import { assertSubjectCloseoutAllowed } from '@/lib/subject/closeout'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import {
  emitSubjectChartSpineEvent,
  emitSubjectEnrollmentRollback,
} from '@/lib/subject/subject-chart/emit-subject-spine'
import { createServerClient } from '@/lib/supabase/server'

const STATUS_VALUES = new Set([
  'screening',
  'screen_failed',
  'enrolled',
  'randomized',
  'completed',
  'withdrawn',
  'screen_failed',
  'lost_to_follow_up',
])

const BLOCKED_TRANSITIONS: Record<string, Set<string>> = {
  randomized: new Set(['screen_failed', 'screening']),
  completed: new Set(['screening', 'screen_failed', 'enrolled', 'randomized', 'withdrawn', 'lost_to_follow_up']),
  withdrawn: new Set(['screening', 'enrolled', 'randomized', 'completed', 'lost_to_follow_up']),
  screen_failed: new Set(['enrolled', 'randomized', 'completed', 'withdrawn', 'lost_to_follow_up']),
  lost_to_follow_up: new Set(['screening', 'enrolled', 'randomized', 'completed', 'withdrawn', 'screen_failed']),
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type SubjectGeneralActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_SUBJECT_GENERAL_STATE: SubjectGeneralActionState = {
  ok: false,
  message: null,
}

export type ExternalRandomizationActionState = SubjectGeneralActionState

export const INITIAL_EXTERNAL_RANDOMIZATION_STATE: ExternalRandomizationActionState = {
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

function subjectUpdateErrorMessage(message: string, code?: string | null) {
  const isDuplicate =
    code === '23505' ||
    message.toLowerCase().includes('duplicate key')
  return isDuplicate ? 'Subject identifier already exists in this study.' : message
}

function parseRandomizationDateTime(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
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
  const expectedUpdatedAt = clean(formData.get('expected_updated_at'))

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
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, message: 'You are not a member of this organization.' }
  }
  if (!canMutateOrganizationData(memberships, organizationId)) {
    return { ok: false, message: 'Your role is read-only for this organization.' }
  }

  const canManageUnblinded = canManageUnblindedData(memberships, organizationId)

  const supabase = await createServerClient()
  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, enrollment_status, updated_at')
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subjectError) return { ok: false, message: subjectError.message }
  if (!subject) return { ok: false, message: 'Subject not found in this organization.' }

  if (expectedUpdatedAt && subject.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: 'This subject has already been enrolled or randomized. Please refresh.' }
  }

  const prevStatus = subject.enrollment_status as string
  if (status === 'randomized' && prevStatus !== 'randomized') {
    return {
      ok: false,
      message: 'Use Record External Randomization to set randomized status from IWRS/RTSM confirmation.',
    }
  }

  if (prevStatus !== status && BLOCKED_TRANSITIONS[prevStatus]?.has(status)) {
    return {
      ok: false,
      message: `Invalid lifecycle transition from ${prevStatus.replace(/_/g, ' ')} to ${status.replace(/_/g, ' ')}.`,
    }
  }

  if (
    ['completed', 'withdrawn', 'screen_failed', 'lost_to_follow_up'].includes(status) &&
    prevStatus !== status
  ) {
    return {
      ok: false,
      message: 'Subject closeout cannot be performed from the general profile form. Use the dedicated closeout action.',
    }
  }
  const isExecutionTransition =
    (status === 'enrolled' || status === 'randomized') &&
    prevStatus !== status

  if (isExecutionTransition) {
    const readiness = await canExecuteStudyRuntime({
      supabase,
      studyId: subject.study_id as string,
      organizationId,
    })

    if (!readiness.canExecute) {
      return {
        ok: false,
        message: `Subject status not changed. Study runtime is not ready for execution: ${formatStudyRuntimeBlockers(readiness)}`,
      }
    }
  }

  const protocolFields = await resolveSubjectProtocolFields(supabase, {
    studyId: subject.study_id as string,
    organizationId,
    subjectId,
    subjectRoleRaw: clean(formData.get('subject_role')),
    householdIdRaw: clean(formData.get('household_id')),
    anchorSubjectIdRaw: clean(formData.get('anchor_subject_id')),
    generateHousehold: formData.get('generate_household') === 'on',
  })
  if (!protocolFields.ok) return { ok: false, message: protocolFields.message }

  const attemptingUnblindedUpdate = Boolean(clean(formData.get('randomization_number')) || clean(formData.get('study_arm')))
  if (attemptingUnblindedUpdate && !canManageUnblinded) {
    return { ok: false, message: 'Your role cannot manage unblinded data such as randomization fields.' }
  }

  const { error } = await supabase
    .from('study_subjects')
    .update({
      subject_identifier: subjectNumber,
      ...(canManageUnblinded
        ? {
            randomization_number: clean(formData.get('randomization_number')),
            randomization_arm: clean(formData.get('study_arm')),
          }
        : {}),
      enrollment_status: status,
      subject_role: protocolFields.subject_role,
      household_id: protocolFields.household_id,
      anchor_subject_id: protocolFields.anchor_subject_id,
      first_name: clean(formData.get('first_name')),
      middle_initial: clean(formData.get('middle_initial')),
      last_name: clean(formData.get('last_name')),
      initials: clean(formData.get('initials')),
      gender: clean(formData.get('gender')),
      date_of_birth: dateOfBirth,
    })
    .eq('id', subjectId)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, message: subjectUpdateErrorMessage(error.message, error.code) }

  await emitSubjectChartSpineEvent({
    supabase,
    organizationId,
    studyId: subject.study_id as string,
    subjectId,
    actorUserId: user.id,
    eventType: OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
    mutation: 'study_subjects.update_general',
    details: {
      prior_enrollment_status: prevStatus,
      enrollment_status: status,
      profile_fields_updated: true,
    },
  })

  if (isExecutionTransition) {
    const { generateSubjectVisitSchedule } = await import(
      '@/lib/visits/generateSubjectVisitSchedule'
    )
    const scheduleResult = await generateSubjectVisitSchedule({
      supabase,
      studySubjectId: subjectId,
    })
    if (!scheduleResult.ok) {
      const { error: rollbackError } = await supabase
        .from('study_subjects')
        .update({ enrollment_status: prevStatus })
        .eq('id', subjectId)
        .eq('organization_id', organizationId)

      await emitSubjectEnrollmentRollback({
        supabase,
        organizationId,
        studyId: subject.study_id as string,
        subjectId,
        actorUserId: user.id,
        eventType: OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
        mutation: 'study_subjects.enrollment_status_rollback',
        details: {
          restored_enrollment_status: prevStatus,
          reason: 'visit_schedule_generation_failed',
          schedule_error: scheduleResult.error,
        },
      })

      const rollbackNote = rollbackError
        ? ` Rollback of enrollment status also failed: ${rollbackError.message}`
        : ' Enrollment status was rolled back.'

      return {
        ok: false,
        message: `Subject was not left ${status.replace(/_/g, ' ')}: visit schedule generation failed (${scheduleResult.error}).${rollbackNote}`,
      }
    }
    if (scheduleResult.createdCount > 0) {
      revalidatePath(`/studies/${subject.study_id}/subjects/${subjectId}/visits`)
    }
  }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject profile saved.' }
}

export async function recordExternalRandomizationAction(
  _prev: ExternalRandomizationActionState,
  formData: FormData,
): Promise<ExternalRandomizationActionState> {
  const subjectId = clean(formData.get('subject_id'))
  const organizationId = clean(formData.get('organization_id'))
  const randomizationNumber = clean(formData.get('randomization_number'))
  const randomizationDateTimeRaw = clean(formData.get('randomization_date_time'))
  const externalReference = clean(formData.get('external_iwrs_rtsm_reference'))
  const randomizationArm = clean(formData.get('randomization_arm'))
  const expectedUpdatedAt = clean(formData.get('expected_updated_at'))

  if (!subjectId || !organizationId) {
    return { ok: false, message: 'Missing subject or organization context.' }
  }
  if (!randomizationNumber) {
    return { ok: false, message: 'Randomization number is required.' }
  }
  const randomizationDateTime = parseRandomizationDateTime(randomizationDateTimeRaw)
  if (!randomizationDateTime) {
    return { ok: false, message: 'Randomization date/time is required.' }
  }
  if (!externalReference) {
    return { ok: false, message: 'External IWRS/RTSM confirmation reference is required.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, message: 'You are not a member of this organization.' }
  }
  if (!canMutateOrganizationData(memberships, organizationId)) {
    return { ok: false, message: 'Your role is read-only for this organization.' }
  }
  if (!canManageUnblindedData(memberships, organizationId)) {
    return { ok: false, message: 'Your role cannot record external randomization details.' }
  }

  const supabase = await createServerClient()
  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select(
      'id, organization_id, study_id, enrollment_status, randomization_number, randomization_date_time, randomization_arm, external_iwrs_rtsm_reference, schedule_anchor_date, updated_at',
    )
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subjectError) return { ok: false, message: subjectError.message }
  if (!subject) return { ok: false, message: 'Subject not found in this organization.' }

  if (expectedUpdatedAt && subject.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: 'This subject has already been enrolled or randomized. Please refresh.' }
  }

  if (subject.enrollment_status === 'randomized' || subject.randomization_number || subject.randomization_date_time) {
    return {
      ok: false,
      message: 'External randomization is already recorded for this subject. Use a correction workflow when available.',
    }
  }

  const readiness = await canExecuteStudyRuntime({
    supabase,
    studyId: subject.study_id as string,
    organizationId,
  })
  if (!readiness.canExecute) {
    return {
      ok: false,
      message: `Subject not randomized. Study runtime is not ready for execution: ${formatStudyRuntimeBlockers(readiness)}`,
    }
  }

  const randomizationIso = randomizationDateTime.toISOString()
  const anchorDate = randomizationIso.slice(0, 10)

  const { error: updateError } = await supabase
    .from('study_subjects')
    .update({
      enrollment_status: 'randomized',
      randomization_number: randomizationNumber,
      randomization_arm: randomizationArm,
      randomization_date_time: randomizationIso,
      external_iwrs_rtsm_reference: externalReference,
      schedule_anchor_date: anchorDate,
    })
    .eq('id', subjectId)
    .eq('organization_id', organizationId)

  if (updateError) {
    return { ok: false, message: updateError.message }
  }

  try {
    await emitSubjectChartSpineEvent({
      supabase,
      organizationId,
      studyId: subject.study_id as string,
      subjectId,
      actorUserId: user.id,
      eventType: OPERATIONAL_EVENT_TYPES.EXTERNAL_RANDOMIZATION_RECORDED,
      mutation: 'study_subjects.external_randomization',
      details: {
        randomization_number: randomizationNumber,
        randomization_date_time: randomizationIso,
        external_iwrs_rtsm_reference: externalReference,
        randomization_arm: randomizationArm,
        source: 'external_iwrs_rtsm',
        product_boundary: 'vilo_records_confirmation_only',
      },
    })
  } catch (eventError) {
    const message = eventError instanceof Error ? eventError.message : String(eventError)
    const { error: rollbackError } = await supabase
      .from('study_subjects')
      .update({
        enrollment_status: subject.enrollment_status,
        randomization_number: subject.randomization_number,
        randomization_arm: subject.randomization_arm,
        randomization_date_time: subject.randomization_date_time,
        external_iwrs_rtsm_reference: subject.external_iwrs_rtsm_reference,
        schedule_anchor_date: subject.schedule_anchor_date,
      })
      .eq('id', subjectId)
      .eq('organization_id', organizationId)

    await emitSubjectEnrollmentRollback({
      supabase,
      organizationId,
      studyId: subject.study_id as string,
      subjectId,
      actorUserId: user.id,
      eventType: OPERATIONAL_EVENT_TYPES.EXTERNAL_RANDOMIZATION_VOIDED,
      mutation: 'study_subjects.external_randomization_rollback',
      details: {
        reason: 'operational_event_logging_failed',
        event_error: message,
      },
    })

    const rollbackNote = rollbackError
      ? ` Rollback also failed: ${rollbackError.message}`
      : ' Randomization update was rolled back.'

    return {
      ok: false,
      message: `Subject was not left randomized: operational event logging failed (${message}).${rollbackNote}`,
    }
  }

  const { generateSubjectVisitSchedule } = await import(
    '@/lib/visits/generateSubjectVisitSchedule'
  )
  const scheduleResult = await generateSubjectVisitSchedule({
    supabase,
    studySubjectId: subjectId,
    anchorDate,
  })

  if (!scheduleResult.ok) {
    const { error: rollbackError } = await supabase
      .from('study_subjects')
      .update({
        enrollment_status: subject.enrollment_status,
        randomization_number: subject.randomization_number,
        randomization_arm: subject.randomization_arm,
        randomization_date_time: subject.randomization_date_time,
        external_iwrs_rtsm_reference: subject.external_iwrs_rtsm_reference,
        schedule_anchor_date: subject.schedule_anchor_date,
      })
      .eq('id', subjectId)
      .eq('organization_id', organizationId)

    await emitSubjectEnrollmentRollback({
      supabase,
      organizationId,
      studyId: subject.study_id as string,
      subjectId,
      actorUserId: user.id,
      eventType: OPERATIONAL_EVENT_TYPES.EXTERNAL_RANDOMIZATION_VOIDED,
      mutation: 'study_subjects.external_randomization_rollback',
      details: {
        void_reason: 'visit_schedule_generation_failed',
        schedule_error: scheduleResult.error,
        product_boundary: 'compensating_event_no_delete',
      },
    })

    const rollbackNote = rollbackError
      ? ` Rollback of randomization also failed: ${rollbackError.message}`
      : ' Randomization was rolled back.'

    return {
      ok: false,
      message: `Subject was not left randomized: visit schedule generation failed (${scheduleResult.error}).${rollbackNote}`,
    }
  }

  revalidatePath(subjectPath(subjectId))
  revalidatePath(`/studies/${subject.study_id}/subjects/${subjectId}/visits`)
  return { ok: true, message: 'External randomization recorded. Visit schedule refreshed from the recorded randomization date.' }
}

type CloseoutContextResult =
  | { ok: false; message: string }
  | {
      ok: true
      subjectId: string
      organizationId: string
      reason: string | null
      date: string
      expectedUpdatedAt: string | null
      user: { id: string }
      supabase: Awaited<ReturnType<typeof createServerClient>>
      subject: {
        id: string
        organization_id: string
        study_id: string
        enrollment_status: string
        updated_at: string
      }
    }

async function applySubjectEnrollmentTransition(params: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  subjectId: string
  organizationId: string
  studyId: string
  expectedUpdatedAt: string | null
  enrollmentStatus: string
  spineEventType: string
  actorUserId: string
  spineDetails: Record<string, unknown>
}) {
  let query = params.supabase
    .from('study_subjects')
    .update({ enrollment_status: params.enrollmentStatus })
    .eq('id', params.subjectId)
    .eq('organization_id', params.organizationId)

  if (params.expectedUpdatedAt) {
    query = query.eq('updated_at', params.expectedUpdatedAt)
  }

  const { data, error } = await query.select('id').maybeSingle()
  if (error) {
    return { ok: false as const, message: subjectUpdateErrorMessage(error.message, error.code) }
  }
  if (!data) {
    return { ok: false as const, message: STALE_WRITE_USER_MESSAGE }
  }

  try {
    await emitSubjectChartSpineEvent({
      supabase: params.supabase,
      organizationId: params.organizationId,
      studyId: params.studyId,
      subjectId: params.subjectId,
      actorUserId: params.actorUserId,
      eventType: params.spineEventType,
      mutation: 'study_subjects.enrollment_status',
      details: params.spineDetails,
    })
  } catch (spineError) {
    const message = spineError instanceof Error ? spineError.message : String(spineError)
    return { ok: false as const, message: `Enrollment updated but spine event failed: ${message}` }
  }

  return { ok: true as const }
}

async function getCloseoutContext(formData: FormData): Promise<CloseoutContextResult> {
  const subjectId = clean(formData.get('subject_id'))
  const organizationId = clean(formData.get('organization_id'))
  const reason = clean(formData.get('reason'))
  const date = clean(formData.get('date'))

  if (!subjectId || !organizationId) {
    return { ok: false, message: 'Missing subject or organization context.' }
  }
  if (!date || !DATE_RE.test(date)) {
    return { ok: false, message: 'A valid date (YYYY-MM-DD) is required.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, message: 'You are not a member of this organization.' }
  }
  if (!canMutateOrganizationData(memberships, organizationId)) {
    return { ok: false, message: 'Your role is read-only for this organization.' }
  }

  const supabase = await createServerClient()
  const expectedUpdatedAt = clean(formData.get('subject_updated_at'))

  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, enrollment_status, updated_at')
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subjectError) return { ok: false, message: subjectError.message }
  if (!subject) return { ok: false, message: 'Subject not found in this organization.' }

  return {
    ok: true,
    subjectId,
    organizationId,
    reason,
    date,
    expectedUpdatedAt,
    user,
    supabase,
    subject: {
      id: subject.id as string,
      organization_id: subject.organization_id as string,
      study_id: subject.study_id as string,
      enrollment_status: subject.enrollment_status as string,
      updated_at: subject.updated_at as string,
    },
  }
}

export async function completeSubjectAction(
  _prev: SubjectGeneralActionState,
  formData: FormData,
): Promise<SubjectGeneralActionState> {
  const ctx = await getCloseoutContext(formData)
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { supabase, subjectId, organizationId, subject, user, date, expectedUpdatedAt } = ctx
  const prevStatus = subject.enrollment_status
  if (prevStatus === 'completed') return { ok: false, message: 'Subject is already completed.' }
  if (BLOCKED_TRANSITIONS[prevStatus]?.has('completed')) {
    return { ok: false, message: `Cannot complete subject from ${prevStatus.replace(/_/g, ' ')} status.` }
  }

  const gate = await assertSubjectCloseoutAllowed(
    supabase,
    subjectId,
    organizationId,
    subject.study_id,
  )
  if (!gate.ok) return { ok: false, message: gate.message }

  const transition = await applySubjectEnrollmentTransition({
    supabase,
    subjectId,
    organizationId,
    studyId: subject.study_id,
    expectedUpdatedAt: expectedUpdatedAt ?? subject.updated_at,
    enrollmentStatus: 'completed',
    spineEventType: OPERATIONAL_EVENT_TYPES.SUBJECT_COMPLETED,
    actorUserId: user.id,
    spineDetails: {
      completion_date: date,
      prior_status: prevStatus,
    },
  })
  if (!transition.ok) return { ok: false, message: transition.message }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject marked completed. Closeout event recorded.' }
}

export async function withdrawSubjectAction(
  _prev: SubjectGeneralActionState,
  formData: FormData,
): Promise<SubjectGeneralActionState> {
  const ctx = await getCloseoutContext(formData)
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!ctx.reason || ctx.reason.length < 10) {
    return { ok: false, message: 'Withdrawal reason is required (min 10 characters).' }
  }

  const { supabase, subjectId, organizationId, subject, user, date, reason, expectedUpdatedAt } =
    ctx
  const prevStatus = subject.enrollment_status
  if (prevStatus === 'withdrawn') return { ok: false, message: 'Subject is already withdrawn.' }
  if (BLOCKED_TRANSITIONS[prevStatus]?.has('withdrawn')) {
    return { ok: false, message: `Cannot withdraw subject from ${prevStatus.replace(/_/g, ' ')} status.` }
  }

  const gate = await assertSubjectCloseoutAllowed(
    supabase,
    subjectId,
    organizationId,
    subject.study_id,
  )
  if (!gate.ok) return { ok: false, message: gate.message }

  const transition = await applySubjectEnrollmentTransition({
    supabase,
    subjectId,
    organizationId,
    studyId: subject.study_id,
    expectedUpdatedAt: expectedUpdatedAt ?? subject.updated_at,
    enrollmentStatus: 'withdrawn',
    spineEventType: OPERATIONAL_EVENT_TYPES.SUBJECT_WITHDRAWN,
    actorUserId: user.id,
    spineDetails: {
      withdrawal_date: date,
      withdrawal_reason: reason,
      prior_status: prevStatus,
    },
  })
  if (!transition.ok) return { ok: false, message: transition.message }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject marked withdrawn — reason documented.' }
}

export async function screenFailSubjectAction(
  _prev: SubjectGeneralActionState,
  formData: FormData,
): Promise<SubjectGeneralActionState> {
  const ctx = await getCloseoutContext(formData)
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!ctx.reason || ctx.reason.length < 10) {
    return { ok: false, message: 'Screen fail reason is required (min 10 characters).' }
  }

  const { supabase, subjectId, organizationId, subject, user, date, reason } = ctx
  const prevStatus = subject.enrollment_status
  if (prevStatus === 'screen_failed') return { ok: false, message: 'Subject is already screen failed.' }
  if (BLOCKED_TRANSITIONS[prevStatus]?.has('screen_failed')) {
    return { ok: false, message: `Cannot screen fail subject from ${prevStatus.replace(/_/g, ' ')} status.` }
  }

  if (prevStatus !== 'screening') {
    const gate = await assertSubjectCloseoutAllowed(
      supabase,
      subjectId,
      organizationId,
      subject.study_id,
    )
    if (!gate.ok) return { ok: false, message: gate.message }
  }

  const transition = await applySubjectEnrollmentTransition({
    supabase,
    subjectId,
    organizationId,
    studyId: subject.study_id,
    expectedUpdatedAt: ctx.expectedUpdatedAt ?? subject.updated_at,
    enrollmentStatus: 'screen_failed',
    spineEventType: OPERATIONAL_EVENT_TYPES.SUBJECT_SCREEN_FAILED,
    actorUserId: user.id,
    spineDetails: {
      screen_fail_date: date,
      screen_fail_reason: reason,
      prior_status: prevStatus,
    },
  })
  if (!transition.ok) return { ok: false, message: transition.message }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject marked screen failed — reason documented.' }
}

export async function lostToFollowUpSubjectAction(
  _prev: SubjectGeneralActionState,
  formData: FormData,
): Promise<SubjectGeneralActionState> {
  const ctx = await getCloseoutContext(formData)
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!ctx.reason || ctx.reason.length < 10) {
    return { ok: false, message: 'LTFU summary/attempts reason is required (min 10 characters).' }
  }

  const { supabase, subjectId, organizationId, subject, user, date, reason } = ctx
  const prevStatus = subject.enrollment_status
  if (prevStatus === 'lost_to_follow_up') return { ok: false, message: 'Subject is already marked LTFU.' }
  if (BLOCKED_TRANSITIONS[prevStatus]?.has('lost_to_follow_up')) {
    return { ok: false, message: `Cannot mark LTFU from ${prevStatus.replace(/_/g, ' ')} status.` }
  }

  const gate = await assertSubjectCloseoutAllowed(
    supabase,
    subjectId,
    organizationId,
    subject.study_id,
  )
  if (!gate.ok) return { ok: false, message: gate.message }

  const transition = await applySubjectEnrollmentTransition({
    supabase,
    subjectId,
    organizationId,
    studyId: subject.study_id,
    expectedUpdatedAt: ctx.expectedUpdatedAt ?? subject.updated_at,
    enrollmentStatus: 'lost_to_follow_up',
    spineEventType: OPERATIONAL_EVENT_TYPES.SUBJECT_LOST_TO_FOLLOW_UP,
    actorUserId: user.id,
    spineDetails: {
      ltfu_date: date,
      ltfu_reason: reason,
      prior_status: prevStatus,
    },
  })
  if (!transition.ok) return { ok: false, message: transition.message }

  revalidatePath(subjectPath(subjectId))
  return { ok: true, message: 'Subject marked lost to follow-up — attempts documented.' }
}
