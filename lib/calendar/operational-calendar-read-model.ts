import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  calendarDayDiff,
  eachCalendarDateBetweenInstants,
  eachCalendarDateInclusive,
  getSiteTimeZone,
  legacyUtcMidnightAllDayDates,
  todayCalendarDate,
} from '@/lib/calendar/site-calendar-dates'
import { filterRowsByBlindingScope } from '@/lib/rbac/blinding'
import { canViewUnblindedData } from '@/lib/rbac/unblinded-access'
import { createServerClient } from '@/lib/supabase/server'
import { enrichOperationalCalendarEvents } from '@/lib/calendar/enrich-operational-calendar-events'
import {
  loadOperationalCalendarSelectorOptions,
  type OperationalCalendarCoordinatorOption,
  type OperationalCalendarStudyOption,
  type OperationalCalendarSubjectOption,
  type OperationalCalendarVisitOption,
} from '@/lib/calendar/operational-calendar-selector-options'
import {
  getRescheduleForScheduledVisit,
  resolveProtocolVisitReschedules,
  type ProtocolVisitRescheduleRow,
} from '@/lib/calendar/resolve-protocol-visit-reschedules'
import {
  resolveAvailabilityBlockChains,
  resolveManualCalendarEvents,
} from '@/lib/calendar/resolve-operational-calendar-chains'
import { visitDetailPath } from '@/lib/ops/paths'

export type {
  OperationalCalendarCoordinatorOption,
  OperationalCalendarStudyOption,
  OperationalCalendarSubjectOption,
  OperationalCalendarVisitOption,
} from '@/lib/calendar/operational-calendar-selector-options'

export type OperationalCalendarStatus = 'upcoming' | 'today' | 'completed'
export type OperationalCalendarEventKind = 'protocol_visit' | 'manual_event' | 'availability_block'
export type OperationalVisitModality = 'onsite' | 'phone' | 'remote' | 'vendor' | 'unspecified'

export type OperationalCalendarProcedure = {
  id: string
  label: string
  status: string | null
  isLabLike: boolean
}

export type OperationalCalendarEvent = {
  scheduled_visit_id: string
  scheduledVisitId: string
  study_id: string
  studyId: string
  subject_id: string
  subjectId: string
  visit_definition_id: string
  visitDefinitionId: string
  visit_id: string | null
  visitId: string | null
  subject_code: string
  subjectCode: string
  subjectIdentifier: string
  study_name: string
  studyName: string
  visit_name: string
  visitName: string
  ideal_date: string
  idealDate: string
  window_open_date: string | null
  windowOpenDate: string | null
  window_close_date: string | null
  windowCloseDate: string | null
  status: OperationalCalendarStatus
  rawStatus: string
  modality: OperationalVisitModality
  assigned_user_id: string | null
  assignedUserId: string | null
  id: string
  kind: OperationalCalendarEventKind
  date: string
  visitNumber: string | null
  protocolDay: number | null
  daysRemaining: number | null
  assignedCoordinator: string
  requiredProcedureCount: number
  requiredProcedures: OperationalCalendarProcedure[]
  labDueCount: number
  imagingDueCount: number
  alerts: string[]
  operationalNotes: string | null
  href: string | null
  manualEventType?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  eventTime?: string | null
  createdBy?: string | null
  createdAt?: string | null
  linkedStudyId?: string | null
  linkedSubjectId?: string | null
  linkedVisitId?: string | null
  linkedVisitLabel?: string | null
  originalEventId?: string | null
  completedAt?: string | null
  completionNotes?: string | null
  calendarEventType?: 'protocol_visit' | 'manual' | 'availability_block'
  blockType?: string | null
  blockScope?: 'user' | 'site' | 'study' | 'resource' | null
  affectedUserId?: string | null
  resourceName?: string | null
  startDatetime?: string | null
  endDatetime?: string | null
  allDay?: boolean | null
  blockStatus?: 'active' | 'cancelled' | null
  displayDate?: string
  displayTime?: string | null
  originalTargetDate?: string | null
  rescheduledDate?: string | null
  rescheduledTime?: string | null
  isRescheduled?: boolean
  rescheduleReason?: string | null
  rescheduleNotes?: string | null
}

export type OperationalCalendarModel = {
  generatedAt: string
  today: string
  siteTimeZone: string
  year: number
  organizationIds: string[]
  canViewUnblinded: boolean
  events: OperationalCalendarEvent[]
  studies: OperationalCalendarStudyOption[]
  subjects: OperationalCalendarSubjectOption[]
  visits: OperationalCalendarVisitOption[]
  coordinators: OperationalCalendarCoordinatorOption[]
  unavailable: string[]
}

type ScheduledVisitRow = {
  id: string
  study_id: string
  subject_id: string
  visit_definition_id: string
  visit_id: string | null
  visit_name: string
  visit_number: string | null
  study_day: number | null
  ideal_date: string
  window_open_date: string | null
  window_close_date: string | null
  status: string
  modality: string | null
  assigned_user_id: string | null
  manual_override: boolean | null
  studies?: { name?: string | null } | { name?: string | null }[] | null
  study_subjects?: { subject_identifier?: string | null } | { subject_identifier?: string | null }[] | null
}

type ManualEventPayload = {
  calendar_event_type?: unknown
  manual_event_action?: unknown
  original_event_id?: unknown
  manual_event_type?: unknown
  title?: unknown
  event_date?: unknown
  event_time?: unknown
  study_id?: unknown
  subject_id?: unknown
  subject_identifier?: unknown
  study_label?: unknown
  subject_label?: unknown
  visit_id?: unknown
  visit_label?: unknown
  assigned_user_id?: unknown
  assigned_user_label?: unknown
  priority?: unknown
  notes?: unknown
  completed_at?: unknown
  completion_notes?: unknown
  cancelled_at?: unknown
  cancel_reason?: unknown
}

type ManualEventRow = {
  id: string
  study_id: string
  visit_id: string | null
  event_type: string
  payload: ManualEventPayload | null
  actor_user_id: string | null
  occurred_at: string
  created_at: string
  studies?: { name?: string | null } | { name?: string | null }[] | null
}

type AvailabilityBlockPayload = {
  calendar_event_type?: unknown
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
  start_date?: unknown
  end_date?: unknown
  all_day?: unknown
  notes?: unknown
  cancelled_at?: unknown
  cancel_reason?: unknown
}

type AvailabilityBlockRow = {
  id: string
  study_id: string
  event_type: string
  payload: AvailabilityBlockPayload | null
  actor_user_id: string | null
  occurred_at: string
  created_at: string
  studies?: { name?: string | null } | { name?: string | null }[] | null
}

type ResolvedManualEvent = {
  row: ManualEventRow
  payload: ManualEventPayload
  status: OperationalCalendarStatus
  cancelled: boolean
  completedAt: string | null
  completionNotes: string | null
}

type ResolvedAvailabilityBlock = {
  row: AvailabilityBlockRow
  payload: AvailabilityBlockPayload
  cancelled: boolean
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeCalendarStatus(status: string | null, idealDate: string, today: string): OperationalCalendarStatus {
  if (status === 'completed') return 'completed'
  if (idealDate === today) return 'today'
  return 'upcoming'
}

function normalizeModality(value: string | null): OperationalVisitModality {
  if (value === 'phone' || value === 'remote' || value === 'vendor' || value === 'onsite') return value
  return 'unspecified'
}

function normalizePriority(value: unknown): 'low' | 'normal' | 'high' | 'urgent' {
  if (value === 'low' || value === 'high' || value === 'urgent') return value
  return 'normal'
}

function resolveManualEvents(rows: ManualEventRow[]): ResolvedManualEvent[] {
  return resolveManualCalendarEvents(rows).map((resolved) => ({
    row: resolved.row,
    payload: resolved.payload as ManualEventPayload,
    status: resolved.status,
    cancelled: resolved.cancelled,
    completedAt: resolved.completedAt,
    completionNotes: resolved.completionNotes,
  }))
}

function resolveAvailabilityBlocks(rows: AvailabilityBlockRow[]): ResolvedAvailabilityBlock[] {
  return resolveAvailabilityBlockChains(rows).map((resolved) => ({
    row: resolved.row,
    payload: resolved.payload as AvailabilityBlockPayload,
    cancelled: resolved.cancelled,
  }))
}

function expandAvailabilityBlockDates(
  payload: AvailabilityBlockPayload,
  startDatetime: string,
  endDatetime: string,
  timeZone: string,
): string[] {
  const allDay = payload.all_day === true
  const startDate = typeof payload.start_date === 'string' ? payload.start_date : null
  const endDate = typeof payload.end_date === 'string' ? payload.end_date : null

  if (allDay && startDate && endDate) {
    return eachCalendarDateInclusive(startDate, endDate)
  }

  if (allDay) {
    const legacy = legacyUtcMidnightAllDayDates(startDatetime, endDatetime)
    if (legacy) return legacy
  }

  return eachCalendarDateBetweenInstants(startDatetime, endDatetime, timeZone)
}

function normalizeBlockScope(value: unknown): 'user' | 'site' | 'study' | 'resource' {
  if (value === 'site' || value === 'study' || value === 'resource') return value
  return 'user'
}

export async function loadOperationalCalendarModel(input?: {
  year?: number
}): Promise<OperationalCalendarModel> {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = memberships.map((membership) => membership.organization_id)
  const canViewUnblinded = canViewUnblindedData(memberships)
  const siteTimeZone = getSiteTimeZone()
  const today = todayCalendarDate(siteTimeZone)
  const requestedYear = input?.year && Number.isFinite(input.year) ? input.year : Number(today.slice(0, 4))
  const year = Math.min(Math.max(Math.trunc(requestedYear), 2000), 2100)
  const unavailable: string[] = []

  if (organizationIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      today,
      siteTimeZone,
      year,
      organizationIds,
      canViewUnblinded: false,
      events: [],
      studies: [],
      subjects: [],
      visits: [],
      coordinators: [],
      unavailable: ['Operational Calendar is unavailable because this user is not assigned to an organization.'],
    }
  }

  const supabase = await createServerClient()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const rescheduleEventsResult = await supabase
    .from('operational_events')
    .select('id, event_type, payload, occurred_at')
    .in('organization_id', organizationIds)
    .in('event_type', ['protocol_visit_rescheduled', 'protocol_visit_reschedule_cancelled'])
    .order('occurred_at', { ascending: true })
    .limit(2000)

  if (rescheduleEventsResult.error) {
    unavailable.push('Protocol visit reschedules are temporarily unavailable.')
  }

  const activeReschedules = resolveProtocolVisitReschedules(
    filterRowsByBlindingScope(
      (rescheduleEventsResult.data ?? []) as ProtocolVisitRescheduleRow[],
      canViewUnblinded,
    ),
  )
  const rescheduledInYearIds = [...activeReschedules.values()]
    .filter((entry) => entry.rescheduledDate >= yearStart && entry.rescheduledDate <= yearEnd)
    .map((entry) => entry.scheduledVisitId)

  const [
    scheduledVisitsByIdealDate,
    scheduledVisitsByReschedule,
    selectorOptions,
    manualEventsResult,
    availabilityBlocksResult,
  ] = await Promise.all([
    supabase
      .from('scheduled_visits')
      .select(`
        id,
        study_id,
        subject_id,
        visit_definition_id,
        visit_id,
        visit_name,
        visit_number,
        study_day,
        ideal_date,
        window_open_date,
        window_close_date,
        status,
        modality,
        assigned_user_id,
        manual_override,
        studies(name),
        study_subjects(subject_identifier)
      `)
      .in('organization_id', organizationIds)
      .gte('ideal_date', yearStart)
      .lte('ideal_date', yearEnd)
      .order('ideal_date', { ascending: true })
      .limit(1200),
    rescheduledInYearIds.length > 0
      ? supabase
        .from('scheduled_visits')
        .select(`
          id,
          study_id,
          subject_id,
          visit_definition_id,
          visit_id,
          visit_name,
          visit_number,
          study_day,
          ideal_date,
          window_open_date,
          window_close_date,
          status,
          modality,
          assigned_user_id,
          manual_override,
          studies(name),
          study_subjects(subject_identifier)
        `)
        .in('organization_id', organizationIds)
        .in('id', rescheduledInYearIds)
        .limit(500)
      : Promise.resolve({ data: [], error: null }),
    loadOperationalCalendarSelectorOptions(supabase, organizationIds, {
      canViewUnblinded,
    }),
    supabase
      .from('operational_events')
      .select('id, study_id, visit_id, event_type, payload, actor_user_id, occurred_at, created_at, studies(name)')
      .in('organization_id', organizationIds)
      .in('event_type', [
        'OPERATIONAL_CALENDAR_MANUAL_EVENT',
        'manual_calendar_event_updated',
        'manual_calendar_event_completed',
        'manual_calendar_event_cancelled',
      ])
      .order('occurred_at', { ascending: true })
      .limit(1500),
    supabase
      .from('operational_events')
      .select('id, study_id, event_type, payload, actor_user_id, occurred_at, created_at, studies(name)')
      .in('organization_id', organizationIds)
      .in('event_type', [
        'calendar_availability_block_created',
        'calendar_availability_block_updated',
        'calendar_availability_block_cancelled',
      ])
      .order('occurred_at', { ascending: true })
      .limit(1500),
  ])

  if (scheduledVisitsByIdealDate.error || scheduledVisitsByReschedule.error) {
    unavailable.push('Scheduled visit planning layer is temporarily unavailable.')
  }
  if (manualEventsResult.error) unavailable.push('Manual operational events are temporarily unavailable.')
  if (availabilityBlocksResult.error) unavailable.push('Availability blocks are temporarily unavailable.')

  const scheduledVisitMap = new Map<string, ScheduledVisitRow>()
  for (const row of [...(scheduledVisitsByIdealDate.data ?? []), ...(scheduledVisitsByReschedule.data ?? [])]) {
    scheduledVisitMap.set(row.id as string, row as ScheduledVisitRow)
  }
  const scheduledVisits = [...scheduledVisitMap.values()]

  const events = scheduledVisits.flatMap((row): OperationalCalendarEvent[] => {
    const study = one(row.studies)
    const subject = one(row.study_subjects)
    const subjectCode = subject?.subject_identifier ?? 'Subject'
    const reschedule = getRescheduleForScheduledVisit(activeReschedules, row.id, row.visit_id)
    const originalTargetDate = row.ideal_date
    const displayDate = reschedule?.rescheduledDate ?? originalTargetDate
    const displayTime = reschedule?.rescheduledTime ?? null
    const assignedUserId = reschedule?.assignedUserId ?? row.assigned_user_id
    const isRescheduled = Boolean(reschedule)

    if (displayDate < yearStart || displayDate > yearEnd) return []

    const status = normalizeCalendarStatus(row.status, displayDate, today)

    return [{
      scheduled_visit_id: row.id,
      scheduledVisitId: row.id,
      study_id: row.study_id,
      studyId: row.study_id,
      subject_id: row.subject_id,
      subjectId: row.subject_id,
      visit_definition_id: row.visit_definition_id,
      visitDefinitionId: row.visit_definition_id,
      visit_id: row.visit_id,
      visitId: row.visit_id,
      subject_code: subjectCode,
      subjectCode,
      subjectIdentifier: subjectCode,
      study_name: study?.name ?? 'Study',
      studyName: study?.name ?? 'Study',
      visit_name: row.visit_name,
      visitName: row.visit_name,
      ideal_date: originalTargetDate,
      idealDate: originalTargetDate,
      window_open_date: row.window_open_date,
      windowOpenDate: row.window_open_date,
      window_close_date: row.window_close_date,
      windowCloseDate: row.window_close_date,
      status,
      rawStatus: row.status,
      modality: normalizeModality(row.modality),
      assigned_user_id: assignedUserId,
      assignedUserId,
      id: `scheduled:${row.id}`,
      kind: 'protocol_visit',
      date: displayDate,
      visitNumber: row.visit_number,
      protocolDay: row.study_day,
      daysRemaining: calendarDayDiff(today, displayDate),
      assignedCoordinator: assignedUserId ? 'Assigned user' : 'Unassigned',
      requiredProcedureCount: 0,
      requiredProcedures: [],
      labDueCount: 0,
      imagingDueCount: 0,
      alerts: [],
      operationalNotes: null,
      href: row.visit_id ? visitDetailPath(row.visit_id) : null,
      calendarEventType: 'protocol_visit',
      displayDate,
      displayTime,
      originalTargetDate,
      rescheduledDate: reschedule?.rescheduledDate ?? null,
      rescheduledTime: reschedule?.rescheduledTime ?? null,
      isRescheduled,
      rescheduleReason: reschedule?.reason ?? null,
      rescheduleNotes: reschedule?.notes ?? null,
    }]
  })

  const manualEvents = resolveManualEvents(
    filterRowsByBlindingScope(
      (manualEventsResult.data ?? []) as ManualEventRow[],
      canViewUnblinded,
    ),
  )
    .filter((resolved) => {
      if (resolved.cancelled) return false
      const eventDate = typeof resolved.payload.event_date === 'string'
        ? resolved.payload.event_date
        : resolved.row.occurred_at.slice(0, 10)
      return eventDate >= yearStart && eventDate <= yearEnd
    })
    .map((resolved): OperationalCalendarEvent => {
    const row = resolved.row
    const payload = resolved.payload
    const study = one(row.studies)
    const eventDate = typeof payload.event_date === 'string' ? payload.event_date : row.occurred_at.slice(0, 10)
    const title = typeof payload.title === 'string' ? payload.title : 'Manual operational event'
    const manualEventType = typeof payload.manual_event_type === 'string' ? payload.manual_event_type : 'other'
    const priority = normalizePriority(payload.priority)
    const subjectId = typeof payload.subject_id === 'string' && payload.subject_id ? payload.subject_id : ''
    const visitId = typeof payload.visit_id === 'string' && payload.visit_id
      ? payload.visit_id
      : row.visit_id
    const linkedStudyId = typeof payload.study_id === 'string' ? payload.study_id : null
    const assignedUserId = typeof payload.assigned_user_id === 'string' ? payload.assigned_user_id : null
    const studyLabelFallback = typeof payload.study_label === 'string' ? payload.study_label : study?.name ?? null
    const subjectLabelFallback = typeof payload.subject_label === 'string'
      ? payload.subject_label
      : typeof payload.subject_identifier === 'string'
        ? payload.subject_identifier
        : null
    const visitLabelFallback = typeof payload.visit_label === 'string' ? payload.visit_label : null
    const assignedLabelFallback = typeof payload.assigned_user_label === 'string'
      ? payload.assigned_user_label
      : null

    return {
      scheduled_visit_id: row.id,
      scheduledVisitId: row.id,
      study_id: linkedStudyId ?? row.study_id,
      studyId: linkedStudyId ?? row.study_id,
      subject_id: subjectId,
      subjectId,
      visit_definition_id: '',
      visitDefinitionId: '',
      visit_id: visitId,
      visitId,
      subject_code: subjectLabelFallback ?? '—',
      subjectCode: subjectLabelFallback ?? '—',
      subjectIdentifier: subjectLabelFallback ?? '—',
      study_name: studyLabelFallback ?? 'Unlinked',
      studyName: studyLabelFallback ?? 'Unlinked',
      visit_name: title,
      visitName: title,
      ideal_date: eventDate,
      idealDate: eventDate,
      window_open_date: null,
      windowOpenDate: null,
      window_close_date: null,
      windowCloseDate: null,
      status: resolved.status === 'completed' ? 'completed' : normalizeCalendarStatus(null, eventDate, today),
      rawStatus: resolved.status === 'completed' ? 'completed' : 'manual',
      modality: manualEventType === 'phone_call' ? 'phone' : manualEventType === 'vendor_appointment' ? 'vendor' : 'unspecified',
      assigned_user_id: assignedUserId,
      assignedUserId,
      id: `manual:${row.id}`,
      kind: 'manual_event',
      date: eventDate,
      visitNumber: null,
      protocolDay: null,
      daysRemaining: calendarDayDiff(today, eventDate),
      assignedCoordinator: assignedLabelFallback ?? (assignedUserId ? 'Assigned' : 'Unassigned'),
      requiredProcedureCount: 0,
      requiredProcedures: [],
      labDueCount: 0,
      imagingDueCount: 0,
      alerts: [],
      operationalNotes: typeof payload.notes === 'string' ? payload.notes : null,
      href: visitId ? visitDetailPath(visitId) : null,
      manualEventType,
      priority,
      eventTime: typeof payload.event_time === 'string' ? payload.event_time : null,
      createdBy: row.actor_user_id,
      createdAt: row.created_at ?? row.occurred_at,
      linkedStudyId,
      linkedSubjectId: subjectId || null,
      linkedVisitId: visitId,
      linkedVisitLabel: visitLabelFallback,
      originalEventId: row.id,
      completedAt: resolved.completedAt,
      completionNotes: resolved.completionNotes,
      calendarEventType: 'manual',
    }
  })

  const availabilityBlocks = resolveAvailabilityBlocks(
    filterRowsByBlindingScope(
      (availabilityBlocksResult.data ?? []) as AvailabilityBlockRow[],
      canViewUnblinded,
    ),
  )
    .filter((resolved) => {
      if (resolved.cancelled) return false
      const startDatetime = typeof resolved.payload.start_datetime === 'string' ? resolved.payload.start_datetime : null
      const endDatetime = typeof resolved.payload.end_datetime === 'string' ? resolved.payload.end_datetime : null
      if (!startDatetime || !endDatetime) return false
      const dates = expandAvailabilityBlockDates(resolved.payload, startDatetime, endDatetime, siteTimeZone)
      return dates.some((date) => date >= yearStart && date <= yearEnd)
    })
    .flatMap((resolved): OperationalCalendarEvent[] => {
      const row = resolved.row
      const payload = resolved.payload
      const study = one(row.studies)
      const startDatetime = typeof payload.start_datetime === 'string' ? payload.start_datetime : row.occurred_at
      const endDatetime = typeof payload.end_datetime === 'string' ? payload.end_datetime : row.occurred_at
      const blockScope = normalizeBlockScope(payload.scope)
      const title = typeof payload.title === 'string' ? payload.title : 'Blocked time'
      const blockType = typeof payload.block_type === 'string' ? payload.block_type : 'unavailable'
      const dates = expandAvailabilityBlockDates(payload, startDatetime, endDatetime, siteTimeZone)
        .filter((date) => date >= yearStart && date <= yearEnd)

      return dates.map((date) => ({
        scheduled_visit_id: row.id,
        scheduledVisitId: row.id,
        study_id: typeof payload.study_id === 'string' ? payload.study_id : row.study_id,
        studyId: typeof payload.study_id === 'string' ? payload.study_id : row.study_id,
        subject_id: '',
        subjectId: '',
        visit_definition_id: '',
        visitDefinitionId: '',
        visit_id: null,
        visitId: null,
        subject_code: blockScope === 'site' ? 'Site' : blockScope === 'resource' ? 'Resource' : 'Availability',
        subjectCode: blockScope === 'site' ? 'Site' : blockScope === 'resource' ? 'Resource' : 'Availability',
        subjectIdentifier: blockScope === 'site' ? 'Site' : blockScope === 'resource' ? 'Resource' : 'Availability',
        study_name: study?.name ?? 'Availability',
        studyName: study?.name ?? 'Availability',
        visit_name: title,
        visitName: title,
        ideal_date: date,
        idealDate: date,
        window_open_date: null,
        windowOpenDate: null,
        window_close_date: null,
        windowCloseDate: null,
        status: date === today ? 'today' : 'upcoming',
        rawStatus: 'active',
        modality: 'unspecified',
        assigned_user_id: typeof payload.affected_user_id === 'string' ? payload.affected_user_id : null,
        assignedUserId: typeof payload.affected_user_id === 'string' ? payload.affected_user_id : null,
        id: `block:${row.id}:${date}`,
        kind: 'availability_block',
        date,
        visitNumber: null,
        protocolDay: null,
        daysRemaining: calendarDayDiff(today, date),
        assignedCoordinator: typeof payload.affected_user_id === 'string' ? 'Affected user' : blockScope,
        requiredProcedureCount: 0,
        requiredProcedures: [],
        labDueCount: 0,
        imagingDueCount: 0,
        alerts: [],
        operationalNotes: typeof payload.notes === 'string' ? payload.notes : null,
        href: null,
        calendarEventType: 'availability_block',
        blockType,
        blockScope,
        affectedUserId: typeof payload.affected_user_id === 'string' ? payload.affected_user_id : null,
        resourceName: typeof payload.resource_name === 'string' ? payload.resource_name : null,
        startDatetime,
        endDatetime,
        allDay: payload.all_day === true,
        blockStatus: 'active',
        originalEventId: row.id,
        createdBy: row.actor_user_id,
        createdAt: row.created_at ?? row.occurred_at,
        linkedStudyId: typeof payload.study_id === 'string' ? payload.study_id : null,
      }))
    })

  const combinedEvents = [...events, ...manualEvents, ...availabilityBlocks].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const enrichedEvents = await enrichOperationalCalendarEvents(supabase, combinedEvents)

  return {
    generatedAt: new Date().toISOString(),
    today,
    siteTimeZone,
    year,
    organizationIds,
    canViewUnblinded,
    events: enrichedEvents,
    studies: selectorOptions.studies,
    subjects: selectorOptions.subjects,
    visits: selectorOptions.visits,
    coordinators: selectorOptions.coordinators,
    unavailable,
  }
}
