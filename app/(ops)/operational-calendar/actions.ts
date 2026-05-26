'use server'

import { revalidatePath } from 'next/cache'
import { activeMemberships } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  allDayBlockRange,
  getSiteTimeZone,
  manualEventDayRange,
  timedBlockRange,
  zonedLocalDateTimeToUtcIso,
} from '@/lib/calendar/site-calendar-dates'
import { resolveCalendarLinks, validateOrganizationUser } from '@/lib/calendar/resolve-calendar-links'
import {
  availabilityBlockScheduleOccurredAt,
  manualEventScheduleOccurredAt,
  resolveAvailabilityBlockChainById,
  resolveManualCalendarEventById,
  resolveAvailabilityBlockChains,
  type CalendarChainRow,
} from '@/lib/calendar/resolve-operational-calendar-chains'
import {
  canManageSubjectVisits,
  canManageUnblindedData,
  canMutateOrganizationData,
} from '@/lib/rbac/permissions'
import type { BlindingScope } from '@/lib/rbac/blinding'
import { createServerClient } from '@/lib/supabase/server'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { cancelVisitReschedule, requestVisitReschedule } from '@/lib/visit-schedule/reschedule'
import {
  createCalendarResourceAvailabilityBlock,
  cancelCalendarResourceAvailabilityBlock,
} from '@/lib/resource-runtime'
import type {
  AvailabilityBlockMutationState,
  CreateManualCalendarEventState,
  ManualCalendarEventMutationState,
  ProtocolVisitRescheduleMutationState,
} from './action-state'

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const MANUAL_CALENDAR_MUTATION_EVENT_TYPES = [
  'manual_calendar_event_updated',
  'manual_calendar_event_completed',
  'manual_calendar_event_cancelled',
] as const

const AVAILABILITY_BLOCK_MUTATION_EVENT_TYPES = [
  'calendar_availability_block_updated',
  'calendar_availability_block_cancelled',
] as const

type ManualCalendarOriginalRow = {
  id: string
  organization_id: string
  study_id: string
  visit_id: string | null
  event_type: string
  occurred_at: string
  payload: {
    calendar_event_type?: unknown
    blinding_scope?: unknown
    event_date?: unknown
    event_time?: unknown
  } | null
}

type AvailabilityBlockPayload = {
  calendar_event_type?: unknown
  blinding_scope?: unknown
  availability_block_action?: unknown
  original_block_id?: unknown
  title?: unknown
  block_type?: unknown
  scope?: unknown
  affected_user_id?: unknown
  study_id?: unknown
  resource_name?: unknown
  start_datetime?: unknown
  end_datetime?: unknown
  all_day?: unknown
  notes?: unknown
}

type AvailabilityBlockRow = {
  id: string
  organization_id: string
  study_id: string
  event_type: string
  payload: AvailabilityBlockPayload | null
  occurred_at: string
  created_at?: string | null
}

type ActiveAvailabilityBlock = {
  id: string
  organizationId: string
  studyId: string | null
  scope: string
  affectedUserId: string | null
  startDatetime: string
  endDatetime: string
}

async function getAccessibleOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await getOrganizationMemberships(userId)
  return memberships.map((membership) => membership.organization_id)
}

function parseBlindingScope(value: FormDataEntryValue | null): BlindingScope {
  if (value === 'unblinded' || value === 'blinded') return value
  return 'public_to_site'
}

function blindingScopeFromPayload(payload: { blinding_scope?: unknown } | null | undefined): BlindingScope {
  const scope = payload?.blinding_scope
  if (scope === 'unblinded' || scope === 'blinded') return scope
  return 'public_to_site'
}

async function validateMutationPermission(input: {
  userId: string
  organizationId: string
  blindingScope?: BlindingScope
}): Promise<string | null> {
  const memberships = activeMemberships(
    await getOrganizationMemberships(input.userId),
  )
  if (!canMutateOrganizationData(memberships, input.organizationId)) {
    return 'Your role does not allow changes to organization data.'
  }
  if (!canManageSubjectVisits(memberships, input.organizationId)) {
    return 'Your role does not allow calendar or visit mutations.'
  }
  if (input.blindingScope === 'unblinded' && !canManageUnblindedData(memberships, input.organizationId)) {
    return 'Your role does not allow managing unblinded data.'
  }
  return null
}

function buildEventRange(eventDate: string, eventTime: string | null): { start: string; end: string } {
  return manualEventDayRange(eventDate, eventTime, getSiteTimeZone())
}

function buildBlockRange(input: {
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  allDay: boolean
}): { start: string; end: string; startDate: string; endDate: string; message?: string } {
  const timeZone = getSiteTimeZone()
  const range = input.allDay
    ? allDayBlockRange(input.startDate, input.endDate, timeZone)
    : timedBlockRange(
      input.startDate,
      input.startTime ?? '00:00',
      input.endDate,
      input.endTime ?? '23:59',
      timeZone,
    )

  if (new Date(range.start).getTime() >= new Date(range.end).getTime()) {
    return { ...range, startDate: input.startDate, endDate: input.endDate, message: 'End time must be after start time.' }
  }

  return { ...range, startDate: input.startDate, endDate: input.endDate }
}

function isOverlapping(start: string, end: string, block: ActiveAvailabilityBlock): boolean {
  return new Date(start).getTime() < new Date(block.endDatetime).getTime()
    && new Date(end).getTime() > new Date(block.startDatetime).getTime()
}

function resolveAvailabilityBlocks(rows: AvailabilityBlockRow[]): ActiveAvailabilityBlock[] {
  const blocks: ActiveAvailabilityBlock[] = []

  for (const block of resolveAvailabilityBlockChains(rows)) {
    if (block.cancelled) continue
    const payload = block.payload
    const startDatetime =
      typeof payload.start_datetime === 'string' ? payload.start_datetime : null
    const endDatetime = typeof payload.end_datetime === 'string' ? payload.end_datetime : null
    if (!startDatetime || !endDatetime) continue
    const row = block.row as AvailabilityBlockRow
    blocks.push({
      id: block.id,
      organizationId: row.organization_id,
      studyId: typeof payload.study_id === 'string' ? payload.study_id : row.study_id,
      scope: typeof payload.scope === 'string' ? payload.scope : 'user',
      affectedUserId:
        typeof payload.affected_user_id === 'string' ? payload.affected_user_id : null,
      startDatetime,
      endDatetime,
    })
  }

  return blocks
}

async function loadActiveAvailabilityBlocks(organizationIds: string[]): Promise<ActiveAvailabilityBlock[]> {
  if (organizationIds.length === 0) return []
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('operational_events')
    .select('id, organization_id, study_id, event_type, payload, occurred_at, created_at')
    .in('organization_id', organizationIds)
    .in('event_type', [
      'calendar_availability_block_created',
      'calendar_availability_block_updated',
      'calendar_availability_block_cancelled',
    ])
    .limit(1500)

  if (error) return []
  return resolveAvailabilityBlocks((data ?? []) as AvailabilityBlockRow[])
}

async function validateAvailabilityForAssignment(input: {
  organizationIds: string[]
  assignedUserId: string | null
  studyId: string | null
  start: string
  end: string
}): Promise<string | null> {
  if (!input.assignedUserId) return null
  const blocks = await loadActiveAvailabilityBlocks(input.organizationIds)
  const conflict = blocks.find((block) => {
    if (!isOverlapping(input.start, input.end, block)) return false
    if (block.scope === 'site') return true
    if (block.scope === 'user') return block.affectedUserId === input.assignedUserId
    if (block.scope === 'study') return Boolean(input.studyId && block.studyId === input.studyId)
    return false
  })

  return conflict ? 'This user is unavailable during the selected time.' : null
}

async function loadManualCalendarChainRows(
  originalEventId: string,
  creationRow: ManualCalendarOriginalRow,
  organizationIds: string[],
): Promise<CalendarChainRow[]> {
  const supabase = await createServerClient()
  const { data: mutations, error } = await supabase
    .from('operational_events')
    .select('id, event_type, payload, occurred_at, created_at')
    .in('organization_id', organizationIds)
    .in('event_type', [...MANUAL_CALENDAR_MUTATION_EVENT_TYPES])
    .eq('payload->>original_event_id', originalEventId)

  if (error) return [creationRow as CalendarChainRow]

  return [
    {
      id: creationRow.id,
      event_type: creationRow.event_type,
      payload: (creationRow.payload ?? {}) as Record<string, unknown>,
      occurred_at: creationRow.occurred_at,
    },
    ...((mutations ?? []) as CalendarChainRow[]),
  ]
}

async function effectiveManualEventScheduleOccurredAt(
  originalEventId: string,
  creationRow: ManualCalendarOriginalRow,
  organizationIds: string[],
): Promise<string> {
  const chainRows = await loadManualCalendarChainRows(originalEventId, creationRow, organizationIds)
  const resolved = resolveManualCalendarEventById(chainRows, originalEventId)
  if (!resolved) {
    return manualEventScheduleOccurredAt(
      (creationRow.payload ?? {}) as Record<string, unknown>,
      creationRow.occurred_at,
    )
  }
  return manualEventScheduleOccurredAt(resolved.payload, resolved.row.occurred_at)
}

async function loadAvailabilityBlockChainRows(
  originalBlockId: string,
  creationRow: AvailabilityBlockRow,
  organizationIds: string[],
): Promise<CalendarChainRow[]> {
  const supabase = await createServerClient()
  const { data: mutations, error } = await supabase
    .from('operational_events')
    .select('id, event_type, payload, occurred_at, created_at')
    .in('organization_id', organizationIds)
    .in('event_type', [...AVAILABILITY_BLOCK_MUTATION_EVENT_TYPES])
    .eq('payload->>original_block_id', originalBlockId)

  if (error) return [creationRow as CalendarChainRow]

  return [
    {
      id: creationRow.id,
      event_type: creationRow.event_type,
      payload: (creationRow.payload ?? {}) as Record<string, unknown>,
      occurred_at: creationRow.occurred_at,
      created_at: creationRow.created_at,
    },
    ...((mutations ?? []) as CalendarChainRow[]),
  ]
}

async function effectiveAvailabilityBlockScheduleOccurredAt(
  originalBlockId: string,
  creationRow: AvailabilityBlockRow,
  organizationIds: string[],
): Promise<string> {
  const chainRows = await loadAvailabilityBlockChainRows(originalBlockId, creationRow, organizationIds)
  const resolved = resolveAvailabilityBlockChainById(chainRows, originalBlockId)
  if (!resolved) {
    return availabilityBlockScheduleOccurredAt(
      (creationRow.payload ?? {}) as Record<string, unknown>,
      creationRow.occurred_at,
    )
  }
  return availabilityBlockScheduleOccurredAt(resolved.payload, resolved.row.occurred_at)
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
    .select('id, organization_id, study_id, visit_id, event_type, payload, occurred_at')
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
  const blindingScope = parseBlindingScope(formData.get('blinding_scope'))

  if (!manualEventType || !eventDate || !title) {
    return { ok: false, message: 'Event type, date, and title are required.' }
  }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  if (organizationIds.length === 0) {
    return { ok: false, message: 'No organization access is available for this user.' }
  }

  const supabase = await createServerClient()
  const resolved = await resolveCalendarLinks({
    supabase,
    organizationIds,
    studyId,
    subjectId,
    visitId,
    assignedUserId,
    requireStorageStudy: true,
  })
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const {
    organizationId: resolvedOrganizationId,
    storageStudyId: resolvedStudyId,
    studyId: linkedStudyId,
    subjectId: linkedSubjectId,
    visitId: linkedVisitId,
    studyLabel,
    subjectLabel,
    visitLabel,
    assignedUserLabel,
    subjectIdentifier,
  } = resolved.data

  if (!resolvedStudyId || !resolvedOrganizationId) {
    return { ok: false, message: 'Could not resolve organization calendar storage.' }
  }

  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: resolvedOrganizationId,
    blindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const eventRange = buildEventRange(eventDate, eventTime)
  const conflictMessage = await validateAvailabilityForAssignment({
    organizationIds,
    assignedUserId,
    studyId: linkedStudyId ?? resolvedStudyId,
    start: eventRange.start,
    end: eventRange.end,
  })
  if (conflictMessage) return { ok: false, message: conflictMessage }

  try {
    await logOperationalEvent({
      supabase,
      organizationId: resolvedOrganizationId,
      studyId: resolvedStudyId,
      visitId: linkedVisitId,
      eventType: 'OPERATIONAL_CALENDAR_MANUAL_EVENT',
      actorUserId: user.id,
      occurredAt: zonedLocalDateTimeToUtcIso(eventDate, eventTime ?? '12:00', getSiteTimeZone()),
      payload: {
        calendar_event_type: 'manual',
        blinding_scope: blindingScope,
        manual_event_type: manualEventType,
        title,
        event_date: eventDate,
        event_time: eventTime,
        site_time_zone: getSiteTimeZone(),
        study_id: linkedStudyId,
        subject_id: linkedSubjectId,
        subject_identifier: subjectIdentifier,
        study_label: studyLabel,
        subject_label: subjectLabel,
        visit_id: linkedVisitId,
        visit_label: visitLabel,
        assigned_user_id: assignedUserId,
        assigned_user_label: assignedUserLabel,
        priority,
        notes,
        source: 'operational_calendar',
        guardrail: 'manual_event_does_not_overwrite_protocol_schedule',
      },
    })
  } catch {
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
  const blindingScope = parseBlindingScope(formData.get('blinding_scope'))

  if (!manualEventType || !eventDate || !title) {
    return { ok: false, message: 'Event type, date, and title are required.' }
  }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalManualEvent(originalEventId, organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Manual event could not be validated.' }
  const effectiveBlindingScope =
    blindingScope === 'unblinded' || blindingScopeFromPayload(original.row.payload) === 'unblinded'
      ? 'unblinded'
      : blindingScope
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: original.row.organization_id,
    blindingScope: effectiveBlindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  const resolved = await resolveCalendarLinks({
    supabase,
    organizationIds,
    studyId,
    subjectId,
    visitId,
    assignedUserId,
    requireStorageStudy: false,
  })
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const eventRange = buildEventRange(eventDate, eventTime)
  const conflictMessage = await validateAvailabilityForAssignment({
    organizationIds,
    assignedUserId,
    studyId: resolved.data.studyId ?? original.row.study_id,
    start: eventRange.start,
    end: eventRange.end,
  })
  if (conflictMessage) return { ok: false, message: conflictMessage }

  const scheduleOccurredAt = zonedLocalDateTimeToUtcIso(
    eventDate,
    eventTime ?? '12:00',
    getSiteTimeZone(),
  )

  try {
    await logOperationalEvent({
      supabase,
      organizationId: original.row.organization_id,
      studyId: original.row.study_id,
      visitId: resolved.data.visitId ?? original.row.visit_id,
      eventType: 'manual_calendar_event_updated',
      actorUserId: user.id,
      occurredAt: scheduleOccurredAt,
      payload: {
        calendar_event_type: 'manual',
        blinding_scope: effectiveBlindingScope,
        manual_event_action: 'updated',
        original_event_id: original.row.id,
        title,
        event_date: eventDate,
        event_time: eventTime,
        manual_event_type: manualEventType,
        study_id: resolved.data.studyId,
        subject_id: resolved.data.subjectId,
        subject_identifier: resolved.data.subjectIdentifier,
        study_label: resolved.data.studyLabel,
        subject_label: resolved.data.subjectLabel,
        visit_id: resolved.data.visitId,
        visit_label: resolved.data.visitLabel,
        assigned_user_id: resolved.data.assignedUserId,
        assigned_user_label: resolved.data.assignedUserLabel,
        priority,
        notes,
        source: 'operational_calendar',
        guardrail: 'manual_event_does_not_overwrite_protocol_schedule',
      },
    })
  } catch {
    return { ok: false, message: 'Could not update the manual operational event.' }
  }

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
  const originalBlindingScope = blindingScopeFromPayload(original.row.payload)
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: original.row.organization_id,
    blindingScope: originalBlindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  const scheduleOccurredAt = await effectiveManualEventScheduleOccurredAt(
    original.row.id,
    original.row,
    organizationIds,
  )
  try {
    await logOperationalEvent({
      supabase,
      organizationId: original.row.organization_id,
      studyId: original.row.study_id,
      visitId: original.row.visit_id,
      eventType: 'manual_calendar_event_completed',
      actorUserId: user.id,
      occurredAt: scheduleOccurredAt,
      payload: {
        calendar_event_type: 'manual',
        blinding_scope: originalBlindingScope,
        manual_event_action: 'completed',
        original_event_id: original.row.id,
        completed_at: new Date().toISOString(),
        completion_notes: clean(formData.get('completion_notes')),
      },
    })
  } catch {
    return { ok: false, message: 'Could not mark the manual event complete.' }
  }

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
  const originalBlindingScope = blindingScopeFromPayload(original.row.payload)
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: original.row.organization_id,
    blindingScope: originalBlindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  const scheduleOccurredAt = await effectiveManualEventScheduleOccurredAt(
    original.row.id,
    original.row,
    organizationIds,
  )
  try {
    await logOperationalEvent({
      supabase,
      organizationId: original.row.organization_id,
      studyId: original.row.study_id,
      visitId: original.row.visit_id,
      eventType: 'manual_calendar_event_cancelled',
      actorUserId: user.id,
      occurredAt: scheduleOccurredAt,
      payload: {
        calendar_event_type: 'manual',
        blinding_scope: originalBlindingScope,
        manual_event_action: 'cancelled',
        original_event_id: original.row.id,
        cancelled_at: new Date().toISOString(),
        cancel_reason: clean(formData.get('cancel_reason')),
      },
    })
  } catch {
    return { ok: false, message: 'Could not cancel the manual event.' }
  }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Manual operational event cancelled.' }
}

async function resolveStorageStudy(input: {
  organizationIds: string[]
  studyId: string | null
}): Promise<{ organizationId: string | null; studyId: string | null; message?: string }> {
  const supabase = await createServerClient()

  if (input.studyId) {
    const { data, error } = await supabase
      .from('studies')
      .select('id, organization_id')
      .eq('id', input.studyId)
      .in('organization_id', input.organizationIds)
      .maybeSingle()
    if (error) return { organizationId: null, studyId: null, message: 'Could not validate study access.' }
    if (!data) return { organizationId: null, studyId: null, message: 'Study is unavailable or outside your organization.' }
    return { organizationId: data.organization_id as string, studyId: data.id as string }
  }

  const { data, error } = await supabase
    .from('studies')
    .select('id, organization_id')
    .in('organization_id', input.organizationIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return { organizationId: null, studyId: null, message: 'Could not resolve organization calendar storage.' }
  if (!data) return { organizationId: null, studyId: null, message: 'Create or select a study before adding availability blocks.' }
  return { organizationId: data.organization_id as string, studyId: data.id as string }
}

async function loadOriginalAvailabilityBlock(
  originalBlockId: string | null,
  organizationIds: string[],
): Promise<{ row: AvailabilityBlockRow | null; message?: string }> {
  if (!originalBlockId) return { row: null, message: 'Original availability block is required.' }
  if (organizationIds.length === 0) return { row: null, message: 'No organization access is available for this user.' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('operational_events')
    .select('id, organization_id, study_id, event_type, payload, occurred_at')
    .eq('id', originalBlockId)
    .in('organization_id', organizationIds)
    .maybeSingle()

  if (error) return { row: null, message: 'Could not validate the original availability block.' }
  if (!data) return { row: null, message: 'Availability block is unavailable or outside your organization.' }
  if (data.event_type !== 'calendar_availability_block_created' || data.payload?.calendar_event_type !== 'availability_block') {
    return { row: null, message: 'Only availability blocks can be changed here.' }
  }

  return { row: data as AvailabilityBlockRow }
}

function validateBlockScope(input: {
  scope: string | null
  affectedUserId: string | null
  studyId: string | null
  resourceName: string | null
}): string | null {
  if (!input.scope) return 'Scope is required.'
  if (!['user', 'site', 'study', 'resource'].includes(input.scope)) return 'Scope is not supported.'
  if (input.scope === 'user' && !input.affectedUserId) return 'Affected user is required for user blocks.'
  if (input.scope === 'study' && !input.studyId) return 'Study is required for study blocks.'
  if (input.scope === 'resource' && !input.resourceName) return 'Resource name is required for resource blocks.'
  return null
}

async function writeAvailabilityBlockEvent(input: {
  eventType: 'calendar_availability_block_created' | 'calendar_availability_block_updated'
  organizationId: string
  organizationIds: string[]
  storageStudyId: string
  actorUserId: string
  originalBlockId?: string
  formData: FormData
}): Promise<AvailabilityBlockMutationState> {
  const title = clean(input.formData.get('title'))
  const blockType = clean(input.formData.get('block_type')) ?? 'unavailable'
  const scope = clean(input.formData.get('scope'))
  const affectedUserId = clean(input.formData.get('affected_user_id'))
  const studyId = clean(input.formData.get('study_id'))
  const resourceName = clean(input.formData.get('resource_name'))
  const startDate = clean(input.formData.get('start_date'))
  const startTime = clean(input.formData.get('start_time'))
  const endDate = clean(input.formData.get('end_date'))
  const endTime = clean(input.formData.get('end_time'))
  const allDay = input.formData.get('all_day') === 'on'
  const notes = clean(input.formData.get('notes'))
  const blindingScope = parseBlindingScope(input.formData.get('blinding_scope'))

  if (!title || !scope || !startDate || !endDate) {
    return { ok: false, message: 'Title, scope, start date, and end date are required.' }
  }

  const scopeMessage = validateBlockScope({ scope, affectedUserId, studyId, resourceName })
  if (scopeMessage) return { ok: false, message: scopeMessage }

  const supabaseForValidation = await createServerClient()
  const memberOrgIds = input.organizationIds.length > 0
    ? input.organizationIds
    : [input.organizationId]

  if (scope === 'user') {
    const userError = await validateOrganizationUser(supabaseForValidation, memberOrgIds, affectedUserId)
    if (userError) return { ok: false, message: userError }
  }

  if (scope === 'study' && studyId) {
    const { data, error } = await supabaseForValidation
      .from('studies')
      .select('id')
      .eq('id', studyId)
      .in('organization_id', memberOrgIds)
      .maybeSingle()
    if (error) return { ok: false, message: 'Could not validate study for block.' }
    if (!data) return { ok: false, message: 'Study is unavailable or outside your organization.' }
  }

  let studyLabel: string | null = null
  let affectedUserLabel: string | null = null
  if (studyId) {
    const resolvedStudy = await resolveCalendarLinks({
      supabase: supabaseForValidation,
      organizationIds: memberOrgIds,
      studyId,
      subjectId: null,
      visitId: null,
      assignedUserId: null,
    })
    if (resolvedStudy.ok) studyLabel = resolvedStudy.data.studyLabel
  }
  if (affectedUserId) {
    const resolvedUser = await resolveCalendarLinks({
      supabase: supabaseForValidation,
      organizationIds: memberOrgIds,
      studyId: null,
      subjectId: null,
      visitId: null,
      assignedUserId: affectedUserId,
    })
    if (resolvedUser.ok) affectedUserLabel = resolvedUser.data.assignedUserLabel
  }

  const range = buildBlockRange({ startDate, startTime, endDate, endTime, allDay })
  if (range.message) return { ok: false, message: range.message }

  const permissionMessage = await validateMutationPermission({
    userId: input.actorUserId,
    organizationId: input.organizationId,
    blindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  try {
    await logOperationalEvent({
      supabase,
      organizationId: input.organizationId,
      studyId: input.storageStudyId,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      occurredAt: range.start,
      payload: {
        calendar_event_type: 'availability_block',
        blinding_scope: blindingScope,
        availability_block_action: input.eventType === 'calendar_availability_block_updated' ? 'updated' : 'created',
        original_block_id: input.originalBlockId,
        title,
        block_type: blockType,
        scope,
        affected_user_id: affectedUserId,
        affected_user_label: affectedUserLabel,
        study_id: studyId,
        study_label: studyLabel,
        resource_name: resourceName,
        start_datetime: range.start,
        end_datetime: range.end,
        start_date: range.startDate,
        end_date: range.endDate,
        all_day: allDay,
        site_time_zone: getSiteTimeZone(),
        notes,
      },
    })
  } catch {
    return { ok: false, message: 'Could not save the availability block.' }
  }
  revalidatePath('/operational-calendar')
  return {
    ok: true,
    message: input.eventType === 'calendar_availability_block_updated'
      ? 'Availability block updated.'
      : 'Availability block created.',
  }
}

export async function createAvailabilityBlock(
  _prevState: AvailabilityBlockMutationState,
  formData: FormData,
): Promise<AvailabilityBlockMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  if (organizationIds.length === 0) return { ok: false, message: 'No organization access is available for this user.' }

  const storage = await resolveStorageStudy({ organizationIds, studyId: clean(formData.get('study_id')) })
  if (!storage.organizationId || !storage.studyId) return { ok: false, message: storage.message ?? 'Could not resolve availability block storage.' }

  const scope = clean(formData.get('scope'))
  if (scope === 'resource') {
    return createCalendarResourceAvailabilityBlock({
      eventType: 'calendar_availability_block_created',
      organizationId: storage.organizationId,
      organizationIds,
      storageStudyId: storage.studyId,
      actorUserId: user.id,
      formData,
    })
  }

  return writeAvailabilityBlockEvent({
    eventType: 'calendar_availability_block_created',
    organizationId: storage.organizationId,
    organizationIds,
    storageStudyId: storage.studyId,
    actorUserId: user.id,
    formData,
  })
}

export async function updateAvailabilityBlock(
  _prevState: AvailabilityBlockMutationState,
  formData: FormData,
): Promise<AvailabilityBlockMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalAvailabilityBlock(clean(formData.get('original_block_id')), organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Availability block could not be validated.' }
  const originalPermissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: original.row.organization_id,
    blindingScope: blindingScopeFromPayload(original.row.payload),
  })
  if (originalPermissionMessage) return { ok: false, message: originalPermissionMessage }

  const scope = clean(formData.get('scope'))
  if (scope === 'resource') {
    return createCalendarResourceAvailabilityBlock({
      eventType: 'calendar_availability_block_updated',
      organizationId: original.row.organization_id,
      organizationIds,
      storageStudyId: original.row.study_id,
      actorUserId: user.id,
      originalBlockId: original.row.id,
      formData,
    })
  }

  return writeAvailabilityBlockEvent({
    eventType: 'calendar_availability_block_updated',
    organizationId: original.row.organization_id,
    organizationIds,
    storageStudyId: original.row.study_id,
    actorUserId: user.id,
    originalBlockId: original.row.id,
    formData,
  })
}

export async function cancelAvailabilityBlock(
  _prevState: AvailabilityBlockMutationState,
  formData: FormData,
): Promise<AvailabilityBlockMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const original = await loadOriginalAvailabilityBlock(clean(formData.get('original_block_id')), organizationIds)
  if (!original.row) return { ok: false, message: original.message ?? 'Availability block could not be validated.' }
  const originalBlindingScope = blindingScopeFromPayload(original.row.payload)
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: original.row.organization_id,
    blindingScope: originalBlindingScope,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  const scheduleOccurredAt = await effectiveAvailabilityBlockScheduleOccurredAt(
    original.row.id,
    original.row,
    organizationIds,
  )

  if ((original.row.payload as Record<string, unknown>)?.scope === 'resource') {
    return cancelCalendarResourceAvailabilityBlock({
      originalRow: original.row,
      actorUserId: user.id,
      formData,
      scheduleOccurredAt,
    })
  }

  try {
    await logOperationalEvent({
      supabase,
      organizationId: original.row.organization_id,
      studyId: original.row.study_id,
      eventType: 'calendar_availability_block_cancelled',
      actorUserId: user.id,
      occurredAt: scheduleOccurredAt,
      payload: {
        calendar_event_type: 'availability_block',
        blinding_scope: originalBlindingScope,
        availability_block_action: 'cancelled',
        original_block_id: original.row.id,
        cancelled_at: new Date().toISOString(),
        cancel_reason: clean(formData.get('cancel_reason')),
      },
    })
  } catch {
    return { ok: false, message: 'Could not cancel the availability block.' }
  }
  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Availability block cancelled.' }
}

type ScheduledVisitCalendarRow = {
  id: string
  organization_id: string
  study_id: string
  subject_id: string
  visit_definition_id: string
  visit_id: string | null
  ideal_date: string
  assigned_user_id: string | null
}

async function loadScheduledVisitForCalendar(
  scheduledVisitId: string | null,
  organizationIds: string[],
): Promise<{ row: ScheduledVisitCalendarRow | null; message?: string }> {
  if (!scheduledVisitId) return { row: null, message: 'Scheduled visit is required.' }
  if (organizationIds.length === 0) return { row: null, message: 'No organization access is available for this user.' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('scheduled_visits')
    .select('id, organization_id, study_id, subject_id, visit_definition_id, visit_id, ideal_date, assigned_user_id')
    .eq('id', scheduledVisitId)
    .in('organization_id', organizationIds)
    .maybeSingle()

  if (error) return { row: null, message: 'Could not validate the scheduled visit.' }
  if (!data) return { row: null, message: 'Scheduled visit is unavailable or outside your organization.' }
  return { row: data as ScheduledVisitCalendarRow }
}

export async function rescheduleProtocolVisit(
  _prevState: ProtocolVisitRescheduleMutationState,
  formData: FormData,
): Promise<ProtocolVisitRescheduleMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const scheduledVisitId = clean(formData.get('scheduled_visit_id'))
  const rescheduledDate = clean(formData.get('rescheduled_date'))
  const rescheduledTime = clean(formData.get('rescheduled_time'))
  const assignedUserId = clean(formData.get('assigned_user_id'))
  const reason = clean(formData.get('reason'))
  const notes = clean(formData.get('notes'))

  if (!rescheduledDate) {
    return { ok: false, message: 'Rescheduled date is required.' }
  }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const scheduled = await loadScheduledVisitForCalendar(scheduledVisitId, organizationIds)
  if (!scheduled.row) return { ok: false, message: scheduled.message ?? 'Scheduled visit could not be validated.' }
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: scheduled.row.organization_id,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const effectiveAssignedUserId = assignedUserId ?? scheduled.row.assigned_user_id
  const supabase = await createServerClient()

  const userError = await validateOrganizationUser(supabase, organizationIds, effectiveAssignedUserId)
  if (userError) return { ok: false, message: userError }

  const eventRange = buildEventRange(rescheduledDate, rescheduledTime)
  const conflictMessage = await validateAvailabilityForAssignment({
    organizationIds,
    assignedUserId: effectiveAssignedUserId,
    studyId: scheduled.row.study_id,
    start: eventRange.start,
    end: eventRange.end,
  })
  if (conflictMessage) return { ok: false, message: conflictMessage }

  try {
    await requestVisitReschedule({
      supabase,
      actorUserId: user.id,
      scheduledVisit: scheduled.row,
      rescheduledDate,
      rescheduledTime,
      assignedUserId: effectiveAssignedUserId,
      reason,
      notes,
    })
  } catch {
    return { ok: false, message: 'Could not reschedule the protocol visit.' }
  }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Protocol visit rescheduled on the operational calendar.' }
}

export async function cancelProtocolVisitReschedule(
  _prevState: ProtocolVisitRescheduleMutationState,
  formData: FormData,
): Promise<ProtocolVisitRescheduleMutationState> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: 'Authentication is required.' }

  const organizationIds = await getAccessibleOrganizationIds(user.id)
  const scheduled = await loadScheduledVisitForCalendar(clean(formData.get('scheduled_visit_id')), organizationIds)
  if (!scheduled.row) return { ok: false, message: scheduled.message ?? 'Scheduled visit could not be validated.' }
  const permissionMessage = await validateMutationPermission({
    userId: user.id,
    organizationId: scheduled.row.organization_id,
  })
  if (permissionMessage) return { ok: false, message: permissionMessage }

  const supabase = await createServerClient()
  try {
    await cancelVisitReschedule({
      supabase,
      actorUserId: user.id,
      scheduledVisit: scheduled.row,
      cancelReason: clean(formData.get('cancel_reason')),
    })
  } catch {
    return { ok: false, message: 'Could not cancel the reschedule.' }
  }

  revalidatePath('/operational-calendar')
  return { ok: true, message: 'Reschedule cancelled. Visit returns to its protocol target date.' }
}
