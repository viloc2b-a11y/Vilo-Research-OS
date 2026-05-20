import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { visitDetailPath } from '@/lib/ops/paths'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

export type OperationalCalendarStatus = 'upcoming' | 'today' | 'completed' | 'overdue'
export type OperationalCalendarEventKind = 'protocol_visit' | 'manual_event'
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
  originalEventId?: string | null
  completedAt?: string | null
  completionNotes?: string | null
}

export type OperationalCalendarStudyOption = {
  id: string
  name: string
}

export type OperationalCalendarSubjectOption = {
  id: string
  studyId: string
  subjectIdentifier: string
}

export type OperationalCalendarVisitOption = {
  id: string
  studyId: string
  subjectId: string
  label: string
}

export type OperationalCalendarModel = {
  generatedAt: string
  today: string
  year: number
  organizationIds: string[]
  events: OperationalCalendarEvent[]
  studies: OperationalCalendarStudyOption[]
  subjects: OperationalCalendarSubjectOption[]
  visits: OperationalCalendarVisitOption[]
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

type ProcedureMapRow = {
  visit_definition_id: string
  procedure_definitions?: { id?: string | null; label?: string | null; code?: string | null } | { id?: string | null; label?: string | null; code?: string | null }[] | null
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
  visit_id?: unknown
  visit_label?: unknown
  assigned_user_id?: unknown
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

type ResolvedManualEvent = {
  row: ManualEventRow
  payload: ManualEventPayload
  status: OperationalCalendarStatus
  cancelled: boolean
  completedAt: string | null
  completionNotes: string | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function dayDiff(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00Z`)
  const to = new Date(`${toIso}T12:00:00Z`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function normalizeCalendarStatus(status: string | null, idealDate: string, today: string): OperationalCalendarStatus {
  if (status === 'completed') return 'completed'
  if (idealDate === today) return 'today'
  if (status === 'overdue' || status === 'missed' || idealDate < today) return 'overdue'
  return 'upcoming'
}

function normalizeModality(value: string | null): OperationalVisitModality {
  if (value === 'phone' || value === 'remote' || value === 'vendor' || value === 'onsite') return value
  return 'unspecified'
}

function isLabLike(label: string): boolean {
  const lower = label.toLowerCase()
  return lower.includes('lab') || lower.includes('blood') || lower.includes('pk') || lower.includes('sample')
}

function isImagingLike(label: string): boolean {
  const lower = label.toLowerCase()
  return lower.includes('image') || lower.includes('scan') || lower.includes('mri') || lower.includes('x-ray') || lower.includes('ct')
}

function normalizePriority(value: unknown): 'low' | 'normal' | 'high' | 'urgent' {
  if (value === 'low' || value === 'high' || value === 'urgent') return value
  return 'normal'
}

function isManualCreation(row: ManualEventRow): boolean {
  return row.event_type === 'OPERATIONAL_CALENDAR_MANUAL_EVENT' && row.payload?.calendar_event_type === 'manual'
}

function resolveManualEvents(rows: ManualEventRow[]): ResolvedManualEvent[] {
  const resolved = new Map<string, ResolvedManualEvent>()

  for (const row of rows) {
    const payload = row.payload ?? {}
    if (isManualCreation(row)) {
      resolved.set(row.id, {
        row,
        payload,
        status: 'upcoming',
        cancelled: false,
        completedAt: null,
        completionNotes: null,
      })
      continue
    }

    const originalEventId = typeof payload.original_event_id === 'string' ? payload.original_event_id : null
    if (!originalEventId) continue

    const current = resolved.get(originalEventId)
    if (!current) continue

    if (row.event_type === 'manual_calendar_event_updated' && payload.manual_event_action === 'updated') {
      resolved.set(originalEventId, {
        ...current,
        payload: {
          ...current.payload,
          ...payload,
        },
      })
      continue
    }

    if (row.event_type === 'manual_calendar_event_completed' && payload.manual_event_action === 'completed') {
      resolved.set(originalEventId, {
        ...current,
        status: 'completed',
        completedAt: typeof payload.completed_at === 'string' ? payload.completed_at : row.occurred_at,
        completionNotes: typeof payload.completion_notes === 'string' ? payload.completion_notes : null,
      })
      continue
    }

    if (row.event_type === 'manual_calendar_event_cancelled' && payload.manual_event_action === 'cancelled') {
      resolved.set(originalEventId, {
        ...current,
        cancelled: true,
      })
    }
  }

  return [...resolved.values()]
}

export async function loadOperationalCalendarModel(input?: {
  year?: number
}): Promise<OperationalCalendarModel> {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = memberships.map((membership) => membership.organization_id)
  const today = todayIsoDate()
  const requestedYear = input?.year && Number.isFinite(input.year) ? input.year : Number(today.slice(0, 4))
  const year = Math.min(Math.max(Math.trunc(requestedYear), 2000), 2100)
  const unavailable: string[] = []

  if (organizationIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      today,
      year,
      organizationIds,
      events: [],
      studies: [],
      subjects: [],
      visits: [],
      unavailable: ['Operational Calendar is unavailable because this user is not assigned to an organization.'],
    }
  }

  const supabase = await createServerClient()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [scheduledVisitsResult, studiesResult, subjectsResult, manualEventsResult] = await Promise.all([
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
    supabase
      .from('studies')
      .select('id, name')
      .in('organization_id', organizationIds)
      .order('name', { ascending: true })
      .limit(200),
    supabase
      .from('study_subjects')
      .select('id, study_id, subject_identifier')
      .in('organization_id', organizationIds)
      .order('subject_identifier', { ascending: true })
      .limit(1000),
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
  ])

  if (scheduledVisitsResult.error) unavailable.push('Scheduled visit planning layer is temporarily unavailable.')
  if (studiesResult.error) unavailable.push('Study options are temporarily unavailable.')
  if (subjectsResult.error) unavailable.push('Subject options are temporarily unavailable.')
  if (manualEventsResult.error) unavailable.push('Manual operational events are temporarily unavailable.')

  const scheduledVisits = (scheduledVisitsResult.data ?? []) as ScheduledVisitRow[]
  const visitDefinitionIds = [...new Set(scheduledVisits.map((row) => row.visit_definition_id))]
  const procedureMapsResult = visitDefinitionIds.length > 0
    ? await supabase
      .from('visit_def_procedure_map')
      .select('visit_definition_id, procedure_definitions(id, label, code)')
      .in('visit_definition_id', visitDefinitionIds)
      .limit(2000)
    : { data: [], error: null }

  if (procedureMapsResult.error) unavailable.push('Procedure due counts are temporarily unavailable.')

  const proceduresByVisitDefinitionId = new Map<string, OperationalCalendarProcedure[]>()
  for (const row of (procedureMapsResult.data ?? []) as ProcedureMapRow[]) {
    const definition = one(row.procedure_definitions)
    const label = definition?.label ?? definition?.code ?? 'Procedure'
    const list = proceduresByVisitDefinitionId.get(row.visit_definition_id) ?? []
    list.push({
      id: definition?.id ?? `${row.visit_definition_id}:${list.length}`,
      label,
      status: 'planned',
      isLabLike: isLabLike(label),
    })
    proceduresByVisitDefinitionId.set(row.visit_definition_id, list)
  }

  const events = scheduledVisits.map((row): OperationalCalendarEvent => {
    const study = one(row.studies)
    const subject = one(row.study_subjects)
    const subjectCode = subject?.subject_identifier ?? 'Subject'
    const procedures = proceduresByVisitDefinitionId.get(row.visit_definition_id) ?? []
    const status = normalizeCalendarStatus(row.status, row.ideal_date, today)
    const alerts = [
      status === 'overdue' ? 'Scheduled visit is overdue' : null,
      row.manual_override ? 'Manual override active' : null,
    ].filter(Boolean) as string[]

    return {
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
      ideal_date: row.ideal_date,
      idealDate: row.ideal_date,
      window_open_date: row.window_open_date,
      windowOpenDate: row.window_open_date,
      window_close_date: row.window_close_date,
      windowCloseDate: row.window_close_date,
      status,
      rawStatus: row.status,
      modality: normalizeModality(row.modality),
      assigned_user_id: row.assigned_user_id,
      assignedUserId: row.assigned_user_id,
      id: `scheduled:${row.id}`,
      kind: 'protocol_visit',
      date: row.ideal_date,
      visitNumber: row.visit_number,
      protocolDay: row.study_day,
      daysRemaining: dayDiff(today, row.ideal_date),
      assignedCoordinator: row.assigned_user_id ? 'Assigned user' : 'Unassigned',
      requiredProcedureCount: procedures.length,
      requiredProcedures: procedures,
      labDueCount: procedures.filter((procedure) => procedure.isLabLike).length,
      imagingDueCount: procedures.filter((procedure) => isImagingLike(procedure.label)).length,
      alerts,
      operationalNotes: null,
      href: row.visit_id ? visitDetailPath(row.visit_id) : null,
    }
  })

  const manualEvents = resolveManualEvents((manualEventsResult.data ?? []) as ManualEventRow[])
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
    const subjectId = typeof payload.subject_id === 'string' ? payload.subject_id : ''
    const visitId = typeof payload.visit_id === 'string' ? payload.visit_id : row.visit_id
    const linkedStudyId = typeof payload.study_id === 'string' ? payload.study_id : null
    const assignedUserId = typeof payload.assigned_user_id === 'string' ? payload.assigned_user_id : null

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
      subject_code: typeof payload.subject_identifier === 'string' ? payload.subject_identifier : 'Manual',
      subjectCode: typeof payload.subject_identifier === 'string' ? payload.subject_identifier : 'Manual',
      subjectIdentifier: typeof payload.subject_identifier === 'string' ? payload.subject_identifier : 'Manual',
      study_name: study?.name ?? 'Unlinked calendar event',
      studyName: study?.name ?? 'Unlinked calendar event',
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
      daysRemaining: dayDiff(today, eventDate),
      assignedCoordinator: assignedUserId ? 'Assigned user' : 'Unassigned',
      requiredProcedureCount: 0,
      requiredProcedures: [],
      labDueCount: manualEventType === 'lab_redraw' ? 1 : 0,
      imagingDueCount: 0,
      alerts: priority === 'urgent' ? ['Urgent manual event'] : priority === 'high' ? ['High-priority manual event'] : [],
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
      originalEventId: row.id,
      completedAt: resolved.completedAt,
      completionNotes: resolved.completionNotes,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    today,
    year,
    organizationIds,
    events: [...events, ...manualEvents].sort((a, b) => a.date.localeCompare(b.date)),
    studies: (studiesResult.data ?? []).map((study) => ({
      id: study.id as string,
      name: study.name as string,
    })),
    subjects: (subjectsResult.data ?? []).map((subject) => ({
      id: subject.id as string,
      studyId: subject.study_id as string,
      subjectIdentifier: subject.subject_identifier as string,
    })),
    visits: events
      .filter((event) => event.visitId)
      .map((event) => ({
        id: event.visitId as string,
        studyId: event.studyId,
        subjectId: event.subjectId,
        label: `${event.subjectIdentifier} · ${event.visitName}`,
      })),
    unavailable,
  }
}
