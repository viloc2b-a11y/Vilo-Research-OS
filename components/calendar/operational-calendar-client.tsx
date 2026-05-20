'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  MapPin,
  Pencil,
  Phone,
  UserRound,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cancelManualCalendarEvent,
  completeManualCalendarEvent,
  createManualCalendarEvent,
  type CreateManualCalendarEventState,
  updateManualCalendarEvent,
} from '@/app/(ops)/operational-calendar/actions'
import type {
  OperationalCalendarEvent,
  OperationalCalendarModel,
  OperationalCalendarStatus,
} from '@/lib/calendar/operational-calendar-read-model'

type CalendarView = 'year' | 'month' | 'day'
type DrawerState =
  | { mode: 'event'; event: OperationalCalendarEvent }
  | { mode: 'manual'; date?: string }
  | { mode: 'edit-manual'; event: OperationalCalendarEvent }
  | { mode: 'complete-manual'; event: OperationalCalendarEvent }
  | { mode: 'cancel-manual'; event: OperationalCalendarEvent }
  | null

type ManualCalendarAction = (
  prevState: CreateManualCalendarEventState,
  formData: FormData,
) => Promise<CreateManualCalendarEventState>

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

function addDays(iso: string, offset: number): string {
  const date = dateFromIso(iso)
  date.setUTCDate(date.getUTCDate() + offset)
  return isoDate(date)
}

function monthStart(year: number, monthIndex: number): string {
  return isoDate(new Date(Date.UTC(year, monthIndex, 1, 12)))
}

function monthEnd(year: number, monthIndex: number): string {
  return isoDate(new Date(Date.UTC(year, monthIndex + 1, 0, 12)))
}

function sameMonth(iso: string, year: number, monthIndex: number): boolean {
  return iso.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

function statusClass(status: OperationalCalendarStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-primary'
    case 'today':
      return 'bg-blue-500'
    case 'overdue':
      return 'bg-destructive'
    default:
      return 'bg-yellow-500'
  }
}

function eventChipClass(status: OperationalCalendarStatus): string {
  switch (status) {
    case 'completed':
      return 'border-primary/40 bg-accent/30 text-foreground hover:bg-accent/40'
    case 'today':
      return 'border-blue-400/40 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-100'
    case 'overdue':
      return 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
    default:
      return 'border-yellow-400/50 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-100'
  }
}

function ModalityGlyph({
  modality,
  className,
}: {
  modality: OperationalCalendarEvent['modality']
  className?: string
}) {
  if (modality === 'phone' || modality === 'remote') {
    return <Phone className={className} />
  }
  return <MapPin className={className} />
}

function displayDaysRemaining(days: number | null): string {
  if (days === null) return 'Not calculated'
  if (days === 0) return 'Today'
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} remaining`
  return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`
}

function buildMonthCells(year: number, monthIndex: number) {
  const start = dateFromIso(monthStart(year, monthIndex))
  const end = dateFromIso(monthEnd(year, monthIndex))
  const firstGridDate = new Date(start)
  firstGridDate.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const lastGridDate = new Date(end)
  lastGridDate.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()))

  const cells: string[] = []
  const cursor = new Date(firstGridDate)
  while (cursor <= lastGridDate) {
    cells.push(isoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return cells
}

function ManualEventForm({
  model,
  defaultDate,
  event,
  mode = 'create',
  onClose,
}: {
  model: OperationalCalendarModel
  defaultDate?: string
  event?: OperationalCalendarEvent
  mode?: 'create' | 'edit'
  onClose: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const action: ManualCalendarAction = mode === 'edit' ? updateManualCalendarEvent : createManualCalendarEvent
  const [state, formAction, pending] = useActionState(action, initialState)
  const title = mode === 'edit' ? 'Edit manual event' : 'Manual operational event'
  const description = mode === 'edit'
    ? 'Creates a new audit event with the revised details. The original manual event remains unchanged.'
    : 'Adds supplemental planning context without overwriting protocol schedule or windows.'

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'edit' ? <input type="hidden" name="original_event_id" value={event?.originalEventId ?? event?.scheduledVisitId ?? ''} /> : null}
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Event type</span>
        <select name="manual_event_type" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.manualEventType ?? ''} required>
          <option value="">Select event type</option>
          <option value="subject_reminder">subject_reminder</option>
          <option value="phone_call">phone_call</option>
          <option value="lab_redraw">lab_redraw</option>
          <option value="vendor_appointment">vendor_appointment</option>
          <option value="pi_review">pi_review</option>
          <option value="cra_monitoring">cra_monitoring</option>
          <option value="unscheduled_visit">unscheduled_visit</option>
          <option value="operational_follow_up">operational_follow_up</option>
          <option value="other">other</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input name="title" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.visitName ?? ''} required />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Date</span>
          <input name="event_date" type="date" defaultValue={event?.idealDate ?? defaultDate} className="h-9 rounded-md border bg-background px-2" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Time</span>
          <input name="event_time" type="time" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.eventTime ?? ''} />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Study</span>
        <select name="study_id" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.linkedStudyId ?? ''}>
          <option value="">No study link</option>
          {model.studies.map((study) => (
            <option key={study.id} value={study.id}>
              {study.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Subject link</span>
        <select name="subject_id" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.linkedSubjectId ?? ''}>
          <option value="">No subject link</option>
          {model.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.subjectIdentifier}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Visit link</span>
        <select name="visit_id" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.linkedVisitId ?? ''}>
          <option value="">No visit link</option>
          {model.visits.map((visit) => (
            <option key={visit.id} value={visit.id}>
              {visit.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Assigned coordinator</span>
        <input name="assigned_user_id" className="h-9 rounded-md border bg-background px-2" placeholder="Optional user id" defaultValue={event?.assignedUserId ?? ''} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Priority</span>
        <select name="priority" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.priority ?? 'normal'}>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Operational notes</span>
        <textarea name="notes" className="min-h-20 rounded-md border bg-background px-2 py-2" placeholder="Optional" defaultValue={event?.operationalNotes ?? ''} />
      </label>

      {state.message ? (
        <p className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'border-primary/40 bg-accent/30' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (mode === 'edit' ? 'Saving...' : 'Adding...') : mode === 'edit' ? 'Save Changes' : 'Add Manual Event'}
        </Button>
      </div>
    </form>
  )
}

function CompleteManualEventForm({
  event,
  onClose,
}: {
  event: OperationalCalendarEvent
  onClose: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(completeManualCalendarEvent, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="original_event_id" value={event.originalEventId ?? event.scheduledVisitId} />
      <div>
        <h2 className="text-lg font-semibold">Mark complete</h2>
        <p className="text-sm text-muted-foreground">
          Records completion as a new operational event. The original manual event stays immutable.
        </p>
      </div>
      <div className="rounded-md border bg-accent/20 p-3 text-sm">
        <p className="font-medium">{event.visitName}</p>
        <p className="text-muted-foreground">{event.idealDate}</p>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Completion notes</span>
        <textarea name="completion_notes" className="min-h-24 rounded-md border bg-background px-2 py-2" placeholder="Optional" />
      </label>
      {state.message ? (
        <p className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'border-primary/40 bg-accent/30' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Completing...' : 'Mark Complete'}
        </Button>
      </div>
    </form>
  )
}

function CancelManualEventForm({
  event,
  onClose,
}: {
  event: OperationalCalendarEvent
  onClose: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(cancelManualCalendarEvent, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="original_event_id" value={event.originalEventId ?? event.scheduledVisitId} />
      <div>
        <h2 className="text-lg font-semibold">Cancel manual event</h2>
        <p className="text-sm text-muted-foreground">
          Cancelled manual events are hidden from the calendar by default. Protocol schedules are not changed.
        </p>
      </div>
      <div className="rounded-md border bg-accent/20 p-3 text-sm">
        <p className="font-medium">{event.visitName}</p>
        <p className="text-muted-foreground">{event.idealDate}</p>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Cancel reason</span>
        <textarea name="cancel_reason" className="min-h-24 rounded-md border bg-background px-2 py-2" placeholder="Optional" />
      </label>
      {state.message ? (
        <p className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'border-primary/40 bg-accent/30' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Back
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Cancelling...' : 'Cancel Event'}
        </Button>
      </div>
    </form>
  )
}

function EventDrawer({
  state,
  model,
  onClose,
  onNavigate,
}: {
  state: DrawerState
  model: OperationalCalendarModel
  onClose: () => void
  onNavigate: (nextState: DrawerState) => void
}) {
  if (!state) return null
  const drawerEvent = 'event' in state ? state.event : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="outline">
            {state.mode === 'manual' || drawerEvent?.kind === 'manual_event' ? 'Manual event' : 'Protocol visit'}
          </Badge>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-accent/20" onClick={onClose} aria-label="Close drawer">
            <X className="size-4" />
          </button>
        </div>

        {state.mode === 'manual' ? (
          <ManualEventForm model={model} defaultDate={state.date} onClose={onClose} />
        ) : state.mode === 'edit-manual' ? (
          <ManualEventForm model={model} event={state.event} mode="edit" onClose={onClose} />
        ) : state.mode === 'complete-manual' ? (
          <CompleteManualEventForm event={state.event} onClose={onClose} />
        ) : state.mode === 'cancel-manual' ? (
          <CancelManualEventForm event={state.event} onClose={onClose} />
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{state.event.visitName}</h2>
              <p className="text-sm text-muted-foreground">
                {state.event.kind === 'manual_event'
                  ? `${state.event.manualEventType ?? 'manual event'} · ${state.event.priority ?? 'normal'} priority`
                  : state.event.studyName}
              </p>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="rounded-md border bg-accent/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                <p className="font-medium">{state.event.subjectIdentifier}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {state.event.kind === 'manual_event' ? 'Type' : 'Protocol day'}
                  </p>
                  <p className="font-medium">
                    {state.event.kind === 'manual_event'
                      ? state.event.manualEventType ?? 'other'
                      : state.event.protocolDay ? `Day ${state.event.protocolDay}` : 'Manual'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {state.event.kind === 'manual_event' ? 'Event date' : 'Ideal date'}
                  </p>
                  <p className="font-medium">{state.event.idealDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Window open</p>
                  <p className="font-medium">{state.event.windowOpenDate ?? 'N/A'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Window close</p>
                  <p className="font-medium">{state.event.windowCloseDate ?? 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 capitalize">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modality</p>
                  <p className="font-medium">{state.event.modality.replace('_', ' ')}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coordinator</p>
                  <p className="font-medium">{state.event.assignedCoordinator}</p>
                </div>
              </div>
              {state.event.kind === 'manual_event' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                    <p className="font-medium">{state.event.eventTime ?? 'Not set'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created at</p>
                    <p className="font-medium">{state.event.createdAt ?? 'Unknown'}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Required procedures</h3>
              {state.event.requiredProcedures.length ? (
                <ul className="space-y-1 text-sm">
                  {state.event.requiredProcedures.map((procedure) => (
                    <li key={procedure.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{procedure.label}</span>
                      <span className="text-xs text-muted-foreground">{procedure.status ?? 'pending'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No procedure payload is attached to this event.</p>
              )}
            </section>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labs due</p>
                <p className="text-lg font-semibold">{state.event.labDueCount}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Imaging due</p>
                <p className="text-lg font-semibold">{state.event.imagingDueCount}</p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Alerts</h3>
              {state.event.alerts.length ? (
                <ul className="space-y-1">
                  {state.event.alerts.map((alert) => (
                    <li key={alert} className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertTriangle className="size-3" />
                      {alert}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No active alerts.</p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Operational notes</h3>
              <p className="rounded-md border bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
                {state.event.operationalNotes ?? 'No operational notes recorded.'}
              </p>
            </section>

            {state.event.kind === 'manual_event' ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Linked records</h3>
                <dl className="grid gap-2 rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Study</dt>
                    <dd className="text-right">{state.event.linkedStudyId ?? 'None'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Subject</dt>
                    <dd className="text-right">{state.event.linkedSubjectId ?? 'None'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Visit</dt>
                    <dd className="text-right">{state.event.linkedVisitId ?? 'None'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Created by</dt>
                    <dd className="text-right">{state.event.createdBy ?? 'Unknown'}</dd>
                  </div>
                  {state.event.completedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Completed at</dt>
                      <dd className="text-right">{state.event.completedAt}</dd>
                    </div>
                  ) : null}
                </dl>
                {state.event.completionNotes ? (
                  <p className="rounded-md border bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
                    {state.event.completionNotes}
                  </p>
                ) : null}
              </section>
            ) : null}

            {state.event.kind === 'manual_event' ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Manual event actions</h3>
                <div className="grid gap-2">
                  <Button type="button" variant="outline" onClick={() => onNavigate({ mode: 'edit-manual', event: state.event })}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  {state.event.status !== 'completed' ? (
                    <Button type="button" variant="outline" onClick={() => onNavigate({ mode: 'complete-manual', event: state.event })}>
                      <CheckCircle2 className="size-4" />
                      Mark Complete
                    </Button>
                  ) : null}
                  <Button type="button" variant="destructive" onClick={() => onNavigate({ mode: 'cancel-manual', event: state.event })}>
                    <Ban className="size-4" />
                    Cancel Event
                  </Button>
                </div>
              </section>
            ) : null}

            {state.event.href ? (
              <Link
                href={state.event.href}
                className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Open Visit Workspace
              </Link>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  )
}

function MonthEventButton({
  event,
  onOpen,
}: {
  event: OperationalCalendarEvent
  onOpen: (event: OperationalCalendarEvent) => void
}) {
  const isManual = event.kind === 'manual_event'
  const priorityClass =
    event.priority === 'urgent'
      ? 'bg-destructive'
      : event.priority === 'high'
        ? 'bg-yellow-500'
        : event.priority === 'low'
          ? 'bg-muted-foreground'
          : 'bg-primary'

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={`group relative w-full rounded-md border px-2 py-1 text-left text-xs transition-colors ${eventChipClass(event.status)}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${isManual ? priorityClass : statusClass(event.status)}`} />
        <span className="truncate font-medium">{isManual ? event.visitName : event.subjectIdentifier}</span>
      </div>
      <p className="truncate text-[11px] opacity-80">
        {isManual ? `${event.manualEventType ?? 'manual'} · ${event.priority ?? 'normal'}` : event.visitName}
      </p>
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block">
        {isManual ? (
          <>
            <p className="font-medium">{event.manualEventType ?? 'manual event'}</p>
            <p>Time: {event.eventTime ?? 'Not set'}</p>
            <p>Priority: {event.priority ?? 'normal'}</p>
            <p>Assigned: {event.assignedCoordinator}</p>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 font-medium">
              <ModalityGlyph modality={event.modality} className="size-3" />
              {event.modality.replace('_', ' ')}
            </div>
            <p>Window: {event.windowOpenDate ?? 'N/A'} - {event.windowCloseDate ?? 'N/A'}</p>
            <p>{displayDaysRemaining(event.daysRemaining)}</p>
            <p>Required procedures: {event.requiredProcedureCount}</p>
          </>
        )}
      </div>
    </button>
  )
}

export function OperationalCalendarClient({ model }: { model: OperationalCalendarModel }) {
  const router = useRouter()
  const [view, setView] = useState<CalendarView>('month')
  const initialActiveDate = model.today.startsWith(`${model.year}-`) ? model.today : `${model.year}-01-01`
  const [activeDate, setActiveDate] = useState(initialActiveDate)
  const [drawer, setDrawer] = useState<DrawerState>(null)

  const active = dateFromIso(activeDate)
  const activeYear = active.getUTCFullYear()
  const activeMonth = active.getUTCMonth()

  const eventsByDate = useMemo(() => {
    const map = new Map<string, OperationalCalendarEvent[]>()
    for (const event of model.events) {
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    return map
  }, [model.events])

  const monthEvents = useMemo(
    () => model.events.filter((event) => sameMonth(event.date, activeYear, activeMonth)),
    [activeMonth, activeYear, model.events],
  )

  const dayEvents = eventsByDate.get(activeDate) ?? []

  function setCalendarDate(nextDate: string) {
    const nextYear = dateFromIso(nextDate).getUTCFullYear()
    if (nextYear !== model.year) {
      router.push(`/operational-calendar?year=${nextYear}`)
      return
    }
    setActiveDate(nextDate)
  }

  function shiftMonth(offset: number) {
    setCalendarDate(monthStart(activeYear, activeMonth + offset))
  }

  function shiftDay(offset: number) {
    setCalendarDate(addDays(activeDate, offset))
  }

  function shiftCurrentView(offset: number) {
    if (view === 'year') {
      router.push(`/operational-calendar?year=${activeYear + offset}`)
      return
    }
    if (view === 'day') {
      shiftDay(offset)
      return
    }
    shiftMonth(offset)
  }

  return (
    <div className="flex h-full flex-col bg-accent">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Operational Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Protocol visit timing, coordinator workload, phone visits, labs, and operational follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border bg-card p-1">
              {(['year', 'month', 'day'] as CalendarView[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${view === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/30'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setDrawer({ mode: 'manual' })}>
              <FilePlus2 className="size-4" />
              Add Manual Event
            </Button>
          </div>
        </div>
        {model.unavailable.length ? (
          <div className="mt-3 rounded-md border border-yellow-400/40 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">
            {model.unavailable.join(' ')}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftCurrentView(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div>
              <p className="text-lg font-semibold">
                {view === 'year'
                  ? activeYear
                  : view === 'month'
                    ? `${MONTH_LABELS[activeMonth]} ${activeYear}`
                    : activeDate}
              </p>
              <p className="text-xs text-muted-foreground">Generated {new Date(model.generatedAt).toLocaleString()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => shiftCurrentView(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(['upcoming', 'today', 'completed', 'overdue'] as OperationalCalendarStatus[]).map((status) => (
              <span key={status} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 capitalize">
                <span className={`size-2 rounded-full ${statusClass(status)}`} />
                {status}
              </span>
            ))}
          </div>
        </div>

        {view === 'year' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MONTH_LABELS.map((month, monthIndex) => {
              const events = model.events.filter((event) => sameMonth(event.date, activeYear, monthIndex))
              const overdue = events.filter((event) => event.status === 'overdue').length
              const studies = new Set(events.map((event) => event.studyId)).size
              const highWorkload = events.length >= 10
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setActiveDate(monthStart(activeYear, monthIndex))
                    setView('month')
                  }}
                  className={`rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/30 ${highWorkload ? 'border-yellow-400/50' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{month}</p>
                    {highWorkload ? <Badge variant="secondary">High workload</Badge> : null}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-accent/30 p-2">
                      <p className="text-lg font-semibold">{events.length}</p>
                      <p className="text-muted-foreground">Visits</p>
                    </div>
                    <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                      <p className="text-lg font-semibold">{overdue}</p>
                      <p>Overdue</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <p className="text-lg font-semibold">{studies}</p>
                      <p className="text-muted-foreground">Studies</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {view === 'month' ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="grid grid-cols-7 border-b bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {WEEKDAY_LABELS.map((day) => (
                <div key={day} className="px-3 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {buildMonthCells(activeYear, activeMonth).map((date) => {
                const events = eventsByDate.get(date) ?? []
                const isCurrentMonth = sameMonth(date, activeYear, activeMonth)
                const visibleEvents = events.slice(0, 3)
                return (
                  <div key={date} className={`min-h-32 border-b border-r p-2 ${isCurrentMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDate(date)
                        setView('day')
                      }}
                      className={`mb-2 rounded px-1 text-xs font-semibold hover:bg-accent/30 ${date === model.today ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      {Number(date.slice(8, 10))}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawer({ mode: 'manual', date })}
                      className="float-right rounded px-1 text-[10px] font-medium text-muted-foreground hover:bg-accent/30 hover:text-primary"
                    >
                      + Add event
                    </button>
                    <div className="space-y-1">
                      {visibleEvents.map((event) => (
                        <MonthEventButton key={event.id} event={event} onOpen={(item) => setDrawer({ mode: 'event', event: item })} />
                      ))}
                      {events.length > visibleEvents.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDate(date)
                            setView('day')
                          }}
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          +{events.length - visibleEvents.length} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {monthEvents.length === 0 ? (
              <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
                No protocol or manual operational events found for this month.
              </div>
            ) : null}
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-base font-semibold">Daily execution</h2>
              <p className="text-sm text-muted-foreground">{dayEvents.length} scheduled operational item(s)</p>
            </div>
            {dayEvents.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No visits or manual operational events on this day.
              </div>
            ) : (
              <ol className="divide-y">
                {dayEvents.map((event) => {
                  return (
                    <li key={event.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-accent/30">
                        <CalendarDays className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{event.subjectIdentifier}</p>
                          <span className={`size-2 rounded-full ${statusClass(event.status)}`} />
                          <Badge variant="outline" className="capitalize">{event.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.visitName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ModalityGlyph modality={event.modality} className="size-4" />
                        <span className="capitalize">{event.modality.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserRound className="size-4" />
                        <span>{event.assignedCoordinator}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setDrawer({ mode: 'event', event })}>
                        Details
                      </Button>
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                        >
                          Open Visit Workspace
                        </Link>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        ) : null}
      </div>

      <EventDrawer state={drawer} model={model} onClose={() => setDrawer(null)} onNavigate={setDrawer} />
    </div>
  )
}
