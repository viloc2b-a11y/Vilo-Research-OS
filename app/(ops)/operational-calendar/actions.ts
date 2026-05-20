'use server'

import { revalidatePath } from 'next/cache'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export type CreateManualCalendarEventState = {
  ok: boolean
  message: string | null
}

export type ManualCalendarEventMutationState = CreateManualCalendarEventState

type ManualCalendarOriginalRow = {
  id: string
  organization_id: string
  study_id: string
  visit_id: string | null
  event_type: string
  payload: {
    calendar_event_type?: unknown
  } | null
}

async function getAccessibleOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await getOrganizationMemberships(userId)
  return memberships.map((membership) => membership.organization_id)
}

async function loadOriginalManualEvent(
  originalEventId: string | null,
  organizationIds: string[],
): Promise<{ row: ManualCalendarOriginalRow | null; message?: string }> {
  if (!originalEventId) return { row: null, message: 'Original manual event is required.' }
  if (organizationIds.length === 0) return { row: null, message: 'No organization access is available for this user.' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('operational_events')
    .select('id, organization_id, study_id, visit_id, event_type, payload')
    .eq('id', originalEventId)
    .in('organization_id', organizationIds)
    .maybeSingle()

  if (error) return { row: null, message: 'Could not validate the original manual event.' }
  if (!data) return { row: null, message: 'Manual event is unavailable or outside your organization.' }
  if (data.event_type !== 'OPERATIONAL_CALENDAR_MANUAL_EVENT' || data.payload?.calendar_event_type !== 'manual') {
    return { row: null, message: 'Only manual operational calendar events can be changed here.' }
  }

  return { row: data as ManualCalendarOriginalRow }
}

async function validateOptionalCalendarLinks(input: {
  organizationIds: string[]
  studyId: string | null
  subjectId: string | null
  visitId: string | null
}): Promise<string | null> {
  const supabase = await createServerClient()

  if (input.studyId) {
    const { data, error } = await supabase
      .from('studies')
      .select('id')
      .eq('id', input.studyId)
      .in('organization_id', input.organizationIds)
      .maybeSingle()
    if (error) return 'Could not validate study access.'
    if (!data) return 'Study is unavailable or outside your organization.'
  }

  if (input.subjectId) {
    const { data, error } = await supabase
      .from('study_subjects')
      .select('id')
      .eq('id', input.subjectId)
      .in('organization_id', input.organizationIds)
      .maybeSingle()
    if (error) return 'Could not validate related subject.'
    if (!data) return 'Related subject is unavailable or outside your organization.'
  }

  if (input.visitId) {
    const { data, error } = await supabase
      .from('visits')
      .select('id')
      .eq('id', input.visitId)
      .in('organization_id', input.organizationIds)
      .maybeSingle()
    if (error) return 'Could not validate related visit.'
    if (!data) return 'Related visit is unavailable or outside your organization.'
  }

  return null
}

export async function createManualCalendarEvent(
  _prevState: CreateManualCalendarEventState,
  formData: FormData,
): Promise<CreateManualCalendarEventState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const manualEventType = clean(formData.get('manual_event_type'))
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const eventDate = clean(formData.get('event_date'))
  const eventTime = clean(formData.get('event_time'))
  const title = clean(formData.get('title'))
  const assignedUserId = clean(formData.get('assigned_user_id'))
  const notes = clean(formData.get('notes'))
  const priority = clean(formData.get('priority')) ?? 'normal'

  if (!manualEventType || !eventDate || !title) {
    return { ok: false, message: 'Event type, date, and title are required.' }
  }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  if (organizationIds.length === 0) {
    return { ok: false, message: 'No organization access is available for this user.' }
  }

  const supabase = await createServerClient()
  let resolvedStudyId = studyId
  let resolvedOrganizationId: string | null = null
  let subjectIdentifier: string | null = null
  let visitLabel: string | null = null

  if (visitId) {
    const { data: visit, error } = await supabase
      .from('visits')
      .select('id, organization_id, study_id, study_subject_id, visit_definitions(label, code), study_subjects(subject_identifier)')
      .eq('id', visitId)
      .in('organization_id', organizationIds)
      .maybeSingle()

    if (error) return { ok: false, message: 'Could not validate related visit.' }
    if (!visit) return { ok: false, message: 'Related visit is unavailable or outside your organization.' }
    resolvedStudyId = visit.study_id as string
    resolvedOrganizationId = visit.organization_id as string
    const visitDef = Array.isArray(visit.visit_definitions) ? visit.visit_definitions[0] : visit.visit_definitions
    const subject = Array.isArray(visit.study_subjects) ? visit.study_subjects[0] : visit.study_subjects
    visitLabel = visitDef?.label ?? visitDef?.code ?? null
    subjectIdentifier = subject?.subject_identifier ?? null
  }

  if (!resolvedStudyId && subjectId) {
    const { data: subject, error } = await supabase
      .from('study_subjects')
      .select('id, organization_id, study_id, subject_identifier')
      .eq('id', subjectId)
      .in('organization_id', organizationIds)
      .maybeSingle()

    if (error) return { ok: false, message: 'Could not validate related subject.' }
    if (!subject) return { ok: false, message: 'Related subject is unavailable or outside your organization.' }
    resolvedStudyId = subject.study_id as string
    resolvedOrganizationId = subject.organization_id as string
    subjectIdentifier = subject.subject_identifier as string | null
  }

  if (resolvedStudyId) {
    const { data: study, error: studyError } = await supabase
      .from('studies')
      .select('id, organization_id')
      .eq('id', resolvedStudyId)
      .in('organization_id', organizationIds)
      .maybeSingle()

    if (studyError) return { ok: false, message: 'Could not validate study access.' }
    if (!study) return { ok: false, message: 'Study is unavailable or outside your organization.' }
    resolvedOrganizationId = study.organization_id as string
  }

  if (!resolvedStudyId || !resolvedOrganizationId) {
    const { data: fallbackStudy, error } = await supabase
      .from('studies')
      .select('id, organization_id')
      .in('organization_id', organizationIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, message: 'Could not resolve organization calendar storage.' }
    if (!fallbackStudy) return { ok: false, message: 'Create or select a study before adding unlinked calendar events.' }
    resolvedStudyId = fallbackStudy.id as string
    resolvedOrganizationId = fallbackStudy.organization_id as string
  }

  if (!subjectIdentifier && subjectId) {
    subjectIdentifier = await supabase
      .from('study_subjects')
      .select('subject_identifier')
      .eq('id', subjectId)
      .eq('study_id', resolvedStudyId)
      .maybeSingle()
      .then(({ data }) => data?.subject_identifier as string | null ?? null)
  }

  const visitLabelFromDirectLink = !visitLabel && visitId
    ? await supabase
      .from('visits')
      .select('visit_definitions(label, code)')
      .eq('id', visitId)
      .maybeSingle()
      .then(({ data }) => {
        const def = Array.isArray(data?.visit_definitions) ? data.visit_definitions[0] : data?.visit_definitions
        return def?.label ?? def?.code ?? null
      })
    : null

  const { error } = await supabase.from('operational_events').insert({
    organization_id: resolvedOrganizationId,
    study_id: resolvedStudyId,
    visit_id: visitId,
    event_type: 'OPERATIONAL_CALENDAR_MANUAL_EVENT',
    actor_user_id: user.id,
    occurred_at: `${eventDate}T${eventTime ?? '12:00'}:00.000Z`,
    payload: {
      calendar_event_type: 'manual',
      manual_event_type: manualEventType,
      title,
      event_date: eventDate,
      event_time: eventTime,
      study_id: studyId,
      subject_id: subjectId,
      subject_identifier: subjectIdentifier,
      visit_id: visitId,
      visit_label: visitLabel ?? visitLabelFromDirectLink,
      assigned_user_id: assignedUserId,
      priority,
      notes,
      source: 'operational_calendar',
      guardrail: 'manual_event_does_not_overwrite_protocol_schedule',
    },
  })

  if (error) {
    return { ok: false, message: 'Could not create the manual operational event.' }
  }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Manual operational event added.' }
}

export async function updateManualCalendarEvent(
  _prevState: ManualCalendarEventMutationState,
  formData: FormData,
): Promise<ManualCalendarEventMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const originalEventId = clean(formData.get('original_event_id'))
  const manualEventType = clean(formData.get('manual_event_type'))
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const eventDate = clean(formData.get('event_date'))
  const eventTime = clean(formData.get('event_time'))
  const title = clean(formData.get('title'))
  const assignedUserId = clean(formData.get('assigned_user_id'))
  const notes = clean(formData.get('notes'))
  const priority = clean(formData.get('priority')) ?? 'normal'

  if (!manualEventType || !eventDate || !title) {
    return { ok: false, message: 'Event type, date, and title are required.' }
  }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalManualEvent(originalEventId, organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Manual event could not be validated.' }

  const linkValidationMessage = await validateOptionalCalendarLinks({ organizationIds, studyId, subjectId, visitId })
  if (linkValidationMessage) return { ok: false, message: linkValidationMessage }

  const supabase = await createServerClient()
  const { error } = await supabase.from('operational_events').insert({
    organization_id: original.row.organization_id,
    study_id: original.row.study_id,
    visit_id: original.row.visit_id,
    event_type: 'manual_calendar_event_updated',
    actor_user_id: user.id,
    occurred_at: new Date().toISOString(),
    payload: {
      calendar_event_type: 'manual',
      manual_event_action: 'updated',
      original_event_id: original.row.id,
      title,
      event_date: eventDate,
      event_time: eventTime,
      manual_event_type: manualEventType,
      study_id: studyId,
      subject_id: subjectId,
      visit_id: visitId,
      assigned_user_id: assignedUserId,
      priority,
      notes,
      source: 'operational_calendar',
      guardrail: 'manual_event_does_not_overwrite_protocol_schedule',
    },
  })

  if (error) return { ok: false, message: 'Could not update the manual operational event.' }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Manual operational event updated.' }
}

export async function completeManualCalendarEvent(
  _prevState: ManualCalendarEventMutationState,
  formData: FormData,
): Promise<ManualCalendarEventMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalManualEvent(clean(formData.get('original_event_id')), organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Manual event could not be validated.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('operational_events').insert({
    organization_id: original.row.organization_id,
    study_id: original.row.study_id,
    visit_id: original.row.visit_id,
    event_type: 'manual_calendar_event_completed',
    actor_user_id: user.id,
    occurred_at: new Date().toISOString(),
    payload: {
      calendar_event_type: 'manual',
      manual_event_action: 'completed',
      original_event_id: original.row.id,
      completed_at: new Date().toISOString(),
      completion_notes: clean(formData.get('completion_notes')),
    },
  })

  if (error) return { ok: false, message: 'Could not mark the manual event complete.' }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Manual operational event marked complete.' }
}

export async function cancelManualCalendarEvent(
  _prevState: ManualCalendarEventMutationState,
  formData: FormData,
): Promise<ManualCalendarEventMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalManualEvent(clean(formData.get('original_event_id')), organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Manual event could not be validated.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('operational_events').insert({
    organization_id: original.row.organization_id,
    study_id: original.row.study_id,
    visit_id: original.row.visit_id,
    event_type: 'manual_calendar_event_cancelled',
    actor_user_id: user.id,
    occurred_at: new Date().toISOString(),
    payload: {
      calendar_event_type: 'manual',
      manual_event_action: 'cancelled',
      original_event_id: original.row.id,
      cancelled_at: new Date().toISOString(),
      cancel_reason: clean(formData.get('cancel_reason')),
    },
  })

  if (error) return { ok: false, message: 'Could not cancel the manual event.' }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Manual operational event cancelled.' }
}
