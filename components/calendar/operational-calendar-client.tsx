'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Ban,
  CalendarClock,
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
  cancelAvailabilityBlock,
  cancelManualCalendarEvent,
  cancelProtocolVisitReschedule,
  completeManualCalendarEvent,
  createAvailabilityBlock,
  createManualCalendarEvent,
  type CreateManualCalendarEventState,
  rescheduleProtocolVisit,
  updateAvailabilityBlock,
  updateManualCalendarEvent,
} from '@/app/(ops)/operational-calendar/actions'
import type {
  OperationalCalendarEvent,
  OperationalCalendarModel,
  OperationalCalendarStatus,
} from '@/lib/calendar/operational-calendar-read-model'
import {
  CalendarCoordinatorSelect,
  CalendarStudySelect,
  CalendarSubjectSelect,
  CalendarVisitSelect,
  CalendarBlockScopeFields,
  useCalendarLinkFields,
} from '@/components/calendar/operational-calendar-link-fields'
import {
  addCalendarDaysIso,
  allDayInclusiveEndDate,
  allDayStartDate,
  buildMonthGridDates,
  calendarDateInTimeZone,
  formatTimeHmInSiteZone,
  formatZonedTimeRange,
  monthStartIso,
  sameCalendarMonth,
} from '@/lib/calendar/site-calendar-dates'

type CalendarView = 'year' | 'month' | 'day'
type DrawerState =
  | { mode: 'event'; event: OperationalCalendarEvent }
  | { mode: 'manual'; date?: string }
  | { mode: 'edit-manual'; event: OperationalCalendarEvent }
  | { mode: 'complete-manual'; event: OperationalCalendarEvent }
  | { mode: 'cancel-manual'; event: OperationalCalendarEvent }
  | { mode: 'block'; date?: string }
  | { mode: 'edit-block'; event: OperationalCalendarEvent }
  | { mode: 'cancel-block'; event: OperationalCalendarEvent }
  | { mode: 'reschedule-protocol'; event: OperationalCalendarEvent }
  | { mode: 'cancel-reschedule-protocol'; event: OperationalCalendarEvent }
  | null

type ManualCalendarAction = (
  prevState: CreateManualCalendarEventState,
  formData: FormData,
) => Promise<CreateManualCalendarEventState>

type AvailabilityBlockAction = ManualCalendarAction

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

function statusClass(status: OperationalCalendarStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-primary'
    case 'today':
      return 'bg-blue-500'
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
    default:
      return 'border-yellow-400/50 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-100'
  }
}

function displayEventStatus(event: OperationalCalendarEvent): string {
  if (event.kind === 'availability_block') return 'blocked'
  if (event.kind === 'manual_event') {
    return event.status === 'completed' ? 'completed' : 'pending'
  }
  return event.status === 'upcoming' ? 'scheduled' : event.status
}

function formatTimeRange(event: OperationalCalendarEvent, siteTimeZone: string): string {
  if (!event.startDatetime || !event.endDatetime) return 'Time not set'
  return formatZonedTimeRange(event.startDatetime, event.endDatetime, siteTimeZone, event.allDay === true)
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

function ManualEventForm({
  model,
  defaultDate,
  event,
  mode = 'create',
  onClose,
  onSuccess,
}: {
  model: OperationalCalendarModel
  defaultDate?: string
  event?: OperationalCalendarEvent
  mode?: 'create' | 'edit'
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const action: ManualCalendarAction = mode === 'edit' ? updateManualCalendarEvent : createManualCalendarEvent
  const [state, formAction, pending] = useActionState(action, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])
  const title = mode === 'edit' ? 'Edit manual event' : 'Manual operational event'
  const description = mode === 'edit'
    ? 'Creates a new audit event with the revised details. The original manual event remains unchanged.'
    : 'Adds supplemental planning context without overwriting protocol schedule or windows.'

  const link = useCalendarLinkFields(model, {
    studyId: event?.linkedStudyId ?? '',
    subjectId: event?.linkedSubjectId ?? '',
    visitId: event?.linkedVisitId ?? '',
    assignedUserId: event?.assignedUserId ?? '',
  })

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

      <CalendarStudySelect studies={model.studies} value={link.studyId} onChange={link.onStudyChange} />
      <CalendarSubjectSelect
        subjects={link.filteredSubjects}
        value={link.subjectId}
        onChange={link.onSubjectChange}
        studyId={link.studyId}
      />
      <CalendarVisitSelect
        visits={link.filteredVisits}
        subjects={model.subjects}
        value={link.visitId}
        onChange={link.onVisitChange}
        studyId={link.studyId}
        subjectId={link.subjectId}
      />
      <CalendarCoordinatorSelect
        coordinators={model.coordinators}
        value={link.assignedUserId}
        onChange={link.setAssignedUserId}
      />

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Priority</span>
        <select name="priority" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.priority ?? 'normal'}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
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
  onSuccess,
}: {
  event: OperationalCalendarEvent
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(completeManualCalendarEvent, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

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
  onSuccess,
}: {
  event: OperationalCalendarEvent
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(cancelManualCalendarEvent, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

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

function AvailabilityBlockForm({
  model,
  defaultDate,
  event,
  mode = 'create',
  onClose,
  onSuccess,
}: {
  model: OperationalCalendarModel
  defaultDate?: string
  event?: OperationalCalendarEvent
  mode?: 'create' | 'edit'
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const action: AvailabilityBlockAction = mode === 'edit' ? updateAvailabilityBlock : createAvailabilityBlock
  const [state, formAction, pending] = useActionState(action, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

  const siteTimeZone = model.siteTimeZone
  const [scope, setScope] = useState<string>(event?.blockScope ?? 'user')
  const [blockStudyId, setBlockStudyId] = useState(event?.linkedStudyId ?? '')
  const [affectedUserId, setAffectedUserId] = useState(event?.affectedUserId ?? '')

  const startDate = event?.startDatetime
    ? (event.allDay
      ? allDayStartDate(event.startDatetime, siteTimeZone)
      : calendarDateInTimeZone(new Date(event.startDatetime), siteTimeZone))
    : defaultDate
  const endDate = event?.endDatetime
    ? (event.allDay
      ? allDayInclusiveEndDate(event.endDatetime, siteTimeZone)
      : calendarDateInTimeZone(new Date(event.endDatetime), siteTimeZone))
    : defaultDate

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'edit' ? <input type="hidden" name="original_block_id" value={event?.originalEventId ?? event?.scheduledVisitId ?? ''} /> : null}
      <div>
        <h2 className="text-lg font-semibold">{mode === 'edit' ? 'Edit blocked time' : 'Block time'}</h2>
        <p className="text-sm text-muted-foreground">
          Protects staff or site availability without changing protocol schedules.
        </p>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Block title</span>
        <input name="title" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.visitName ?? ''} required />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Block type</span>
        <select name="block_type" className="h-9 rounded-md border bg-background px-2" defaultValue={event?.blockType ?? 'unavailable'}>
          <option value="pto">pto</option>
          <option value="meeting">meeting</option>
          <option value="training">training</option>
          <option value="clinic_closure">clinic_closure</option>
          <option value="site_holiday">site_holiday</option>
          <option value="unavailable">unavailable</option>
          <option value="other">other</option>
        </select>
      </label>

      <CalendarBlockScopeFields
        model={model}
        scope={scope}
        onScopeChange={setScope}
        studyId={blockStudyId}
        onStudyChange={setBlockStudyId}
        affectedUserId={affectedUserId}
        onAffectedUserChange={setAffectedUserId}
        initialResourceName={event?.resourceName ?? ''}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Start date</span>
          <input name="start_date" type="date" className="h-9 rounded-md border bg-background px-2" defaultValue={startDate} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Start time</span>
          <input
            name="start_time"
            type="time"
            className="h-9 rounded-md border bg-background px-2"
            defaultValue={event?.allDay || !event?.startDatetime ? '' : formatTimeHmInSiteZone(event.startDatetime, siteTimeZone)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">End date</span>
          <input name="end_date" type="date" className="h-9 rounded-md border bg-background px-2" defaultValue={endDate} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">End time</span>
          <input
            name="end_time"
            type="time"
            className="h-9 rounded-md border bg-background px-2"
            defaultValue={event?.allDay || !event?.endDatetime ? '' : formatTimeHmInSiteZone(event.endDatetime, siteTimeZone)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="all_day" type="checkbox" defaultChecked={event?.allDay ?? false} />
        <span className="font-medium">All day</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Notes</span>
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
          {pending ? 'Saving...' : mode === 'edit' ? 'Save Block' : 'Block Time'}
        </Button>
      </div>
    </form>
  )
}

function ProtocolVisitRescheduleForm({
  model,
  event,
  onClose,
  onSuccess,
}: {
  model: OperationalCalendarModel
  event: OperationalCalendarEvent
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(rescheduleProtocolVisit, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

  const [assignedUserId, setAssignedUserId] = useState(event.assignedUserId ?? '')

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="scheduled_visit_id" value={event.scheduledVisitId} />
      <div>
        <h2 className="text-lg font-semibold">Reschedule protocol visit</h2>
        <p className="text-sm text-muted-foreground">
          Moves this item on the operational calendar only. Protocol target date and visit definition are unchanged.
        </p>
      </div>

      <div className="rounded-md border bg-accent/20 p-3 text-sm">
        <p className="font-medium">{event.visitName}</p>
        <p className="text-muted-foreground">
          Protocol target: {event.originalTargetDate ?? event.idealDate}
          {event.isRescheduled ? ` · Currently ${event.displayDate ?? event.date}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">New date</span>
          <input
            name="rescheduled_date"
            type="date"
            className="h-9 rounded-md border bg-background px-2"
            defaultValue={event.rescheduledDate ?? event.displayDate ?? event.date}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Time</span>
          <input
            name="rescheduled_time"
            type="time"
            className="h-9 rounded-md border bg-background px-2"
            defaultValue={event.rescheduledTime ?? event.displayTime ?? ''}
          />
        </label>
      </div>

      <CalendarCoordinatorSelect
        coordinators={model.coordinators}
        value={assignedUserId}
        onChange={setAssignedUserId}
        label="Assigned coordinator"
      />

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Reason</span>
        <input name="reason" className="h-9 rounded-md border bg-background px-2" placeholder="Optional" />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Notes</span>
        <textarea name="notes" className="min-h-20 rounded-md border bg-background px-2 py-2" placeholder="Optional" />
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
          {pending ? 'Saving...' : 'Save Reschedule'}
        </Button>
      </div>
    </form>
  )
}

function CancelProtocolRescheduleForm({
  event,
  onClose,
  onSuccess,
}: {
  event: OperationalCalendarEvent
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(cancelProtocolVisitReschedule, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="scheduled_visit_id" value={event.scheduledVisitId} />
      <div>
        <h2 className="text-lg font-semibold">Cancel reschedule</h2>
        <p className="text-sm text-muted-foreground">
          Returns this visit to its protocol target date on the calendar. The underlying schedule row is not modified.
        </p>
      </div>
      <div className="rounded-md border bg-accent/20 p-3 text-sm">
        <p className="font-medium">{event.visitName}</p>
        <p className="text-muted-foreground">
          Display date: {event.displayDate ?? event.date} → returns to {event.originalTargetDate ?? event.idealDate}
        </p>
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
          {pending ? 'Cancelling...' : 'Cancel Reschedule'}
        </Button>
      </div>
    </form>
  )
}

function CancelAvailabilityBlockForm({
  event,
  siteTimeZone,
  onClose,
  onSuccess,
}: {
  event: OperationalCalendarEvent
  siteTimeZone: string
  onClose: () => void
  onSuccess?: () => void
}) {
  const initialState: CreateManualCalendarEventState = { ok: false, message: null }
  const [state, formAction, pending] = useActionState(cancelAvailabilityBlock, initialState)

  useEffect(() => {
    if (!state.ok) return
    onSuccess?.()
  }, [state.ok, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="original_block_id" value={event.originalEventId ?? event.scheduledVisitId} />
      <div>
        <h2 className="text-lg font-semibold">Cancel blocked time</h2>
        <p className="text-sm text-muted-foreground">
          Cancelling the block stops it from preventing future assignments. Historical events remain intact.
        </p>
      </div>
      <div className="rounded-md border bg-accent/20 p-3 text-sm">
        <p className="font-medium">{event.visitName}</p>
        <p className="text-muted-foreground">{formatTimeRange(event, siteTimeZone)}</p>
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
          {pending ? 'Cancelling...' : 'Cancel Block'}
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
  onMutationSuccess,
}: {
  state: DrawerState
  model: OperationalCalendarModel
  onClose: () => void
  onNavigate: (nextState: DrawerState) => void
  onMutationSuccess: () => void
}) {
  if (!state) return null
  const drawerEvent = 'event' in state ? state.event : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="outline">
            {state.mode === 'block' || drawerEvent?.kind === 'availability_block'
              ? 'Availability block'
              : state.mode === 'manual' || drawerEvent?.kind === 'manual_event'
                ? 'Manual event'
                : 'Protocol visit'}
          </Badge>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-accent/20" onClick={onClose} aria-label="Close drawer">
            <X className="size-4" />
          </button>
        </div>

        {state.mode === 'manual' ? (
          <ManualEventForm model={model} defaultDate={state.date} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'block' ? (
          <AvailabilityBlockForm model={model} defaultDate={state.date} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'edit-manual' ? (
          <ManualEventForm model={model} event={state.event} mode="edit" onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'complete-manual' ? (
          <CompleteManualEventForm event={state.event} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'cancel-manual' ? (
          <CancelManualEventForm event={state.event} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'edit-block' ? (
          <AvailabilityBlockForm model={model} event={state.event} mode="edit" onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'cancel-block' ? (
          <CancelAvailabilityBlockForm event={state.event} siteTimeZone={model.siteTimeZone} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'reschedule-protocol' ? (
          <ProtocolVisitRescheduleForm model={model} event={state.event} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.mode === 'cancel-reschedule-protocol' ? (
          <CancelProtocolRescheduleForm event={state.event} onClose={onClose} onSuccess={onMutationSuccess} />
        ) : state.event.kind === 'protocol_visit' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{state.event.visitName}</h2>
              <p className="text-sm text-muted-foreground">
                {state.event.studyName}
                {state.event.isRescheduled ? (
                  <Badge variant="outline" className="ml-2">Rescheduled</Badge>
                ) : null}
              </p>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="rounded-md border bg-accent/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                <p className="font-medium">{state.event.subjectIdentifier}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Protocol day</p>
                  <p className="font-medium">{state.event.protocolDay ? `Day ${state.event.protocolDay}` : '—'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calendar date</p>
                  <p className="font-medium">{state.event.displayDate ?? state.event.date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Protocol target</p>
                  <p className="font-medium">{state.event.originalTargetDate ?? state.event.idealDate}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                  <p className="font-medium">{state.event.displayTime ?? state.event.rescheduledTime ?? 'Not set'}</p>
                </div>
              </div>
              {state.event.isRescheduled ? (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operational reschedule</p>
                  <p className="mt-1 font-medium">
                    {state.event.rescheduledDate ?? state.event.displayDate}
                    {state.event.rescheduledTime ? ` at ${state.event.rescheduledTime}` : ''}
                  </p>
                  {state.event.rescheduleReason ? (
                    <p className="mt-1 text-muted-foreground">Reason: {state.event.rescheduleReason}</p>
                  ) : null}
                  {state.event.rescheduleNotes ? (
                    <p className="mt-1 text-muted-foreground">{state.event.rescheduleNotes}</p>
                  ) : null}
                </div>
              ) : null}
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
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Actions</h3>
              <div className="grid gap-2">
                {state.event.href ? (
                  <Link
                    href={state.event.href}
                    className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    Open Visit Workspace
                  </Link>
                ) : null}
                <Button type="button" variant="outline" onClick={() => onNavigate({ mode: 'reschedule-protocol', event: state.event })}>
                  <CalendarClock className="size-4" />
                  Reschedule
                </Button>
                {state.event.isRescheduled ? (
                  <Button type="button" variant="outline" onClick={() => onNavigate({ mode: 'cancel-reschedule-protocol', event: state.event })}>
                    <Ban className="size-4" />
                    Cancel Reschedule
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{state.event.visitName}</h2>
              <p className="text-sm text-muted-foreground">
                {state.event.kind === 'availability_block'
                  ? `${state.event.blockType ?? 'unavailable'} · ${state.event.blockScope ?? 'site'}`
                  : `${state.event.manualEventType ?? 'manual event'} · ${displayEventStatus(state.event)}`}
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
                    {state.event.kind === 'availability_block' ? 'Scope' : 'Type'}
                  </p>
                  <p className="font-medium">
                    {state.event.kind === 'availability_block'
                      ? state.event.blockScope ?? 'site'
                      : state.event.manualEventType ?? 'other'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                  <p className="font-medium">{state.event.idealDate}</p>
                </div>
              </div>
              {state.event.kind === 'availability_block' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time range</p>
                    <p className="font-medium">{formatTimeRange(state.event, model.siteTimeZone)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected</p>
                    <p className="font-medium">{state.event.assignedCoordinator}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                    <p className="font-medium">{state.event.eventTime ?? 'Not set'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coordinator</p>
                    <p className="font-medium">{state.event.assignedCoordinator}</p>
                  </div>
                </div>
              )}
            </div>

            {state.event.kind === 'manual_event' ? (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Operational notes</h3>
                  <p className="rounded-md border bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
                    {state.event.operationalNotes ?? 'No operational notes recorded.'}
                  </p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Linked records</h3>
                  <dl className="grid gap-2 rounded-md border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Study</dt>
                      <dd className="text-right">{state.event.linkedStudyId ? state.event.studyName : 'None'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Subject</dt>
                      <dd className="text-right">
                        {state.event.linkedSubjectId ? state.event.subjectIdentifier : 'None'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Visit</dt>
                      <dd className="text-right">{state.event.linkedVisitLabel ?? 'None'}</dd>
                    </div>
                  </dl>
                </section>
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
              </>
            ) : (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Blocked time actions</h3>
                <div className="grid gap-2">
                  <Button type="button" variant="outline" onClick={() => onNavigate({ mode: 'edit-block', event: state.event })}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => onNavigate({ mode: 'cancel-block', event: state.event })}>
                    <Ban className="size-4" />
                    Cancel Block
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function MonthEventButton({
  event,
  siteTimeZone,
  onOpen,
}: {
  event: OperationalCalendarEvent
  siteTimeZone: string
  onOpen: (event: OperationalCalendarEvent) => void
}) {
  const isManual = event.kind === 'manual_event'
  const isBlock = event.kind === 'availability_block'

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={`group relative w-full rounded-md border px-2 py-1 text-left text-xs transition-colors ${
        isBlock
          ? 'border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-muted'
          : eventChipClass(event.status)
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${isBlock ? 'bg-muted-foreground' : statusClass(event.status)}`} />
        <span className="truncate font-medium">{isBlock ? 'Blocked' : isManual ? event.visitName : event.subjectIdentifier}</span>
      </div>
      <p className="truncate text-[11px] opacity-80">
        {isBlock ? `${event.blockScope ?? 'site'} · ${event.blockType ?? 'unavailable'}` : isManual ? `${event.manualEventType ?? 'manual'} · ${displayEventStatus(event)}` : event.visitName}
      </p>
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block">
        {isBlock ? (
          <>
            <p className="font-medium">{event.visitName}</p>
            <p>Scope: {event.blockScope ?? 'site'}</p>
            <p>Time: {formatTimeRange(event, siteTimeZone)}</p>
            <p>Affected: {event.affectedUserId ?? event.resourceName ?? event.blockScope ?? 'Site'}</p>
          </>
        ) : isManual ? (
          <>
            <p className="font-medium">{event.manualEventType ?? 'manual event'}</p>
            <p>Time: {event.eventTime ?? 'Not set'}</p>
            <p>Status: {displayEventStatus(event)}</p>
            <p>Assigned: {event.assignedCoordinator}</p>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 font-medium">
              <ModalityGlyph modality={event.modality} className="size-3" />
              {event.modality.replace('_', ' ')}
            </div>
            <p>Calendar date: {event.displayDate ?? event.date}</p>
            <p>Protocol target: {event.originalTargetDate ?? event.idealDate}</p>
            {event.isRescheduled ? <p>Rescheduled from protocol target</p> : null}
            <p>Coordinator: {event.assignedCoordinator}</p>
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

  const activeYear = Number(activeDate.slice(0, 4))
  const activeMonth = Number(activeDate.slice(5, 7)) - 1

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
    () => model.events.filter((event) => sameCalendarMonth(event.date, activeYear, activeMonth)),
    [activeMonth, activeYear, model.events],
  )

  const dayEvents = eventsByDate.get(activeDate) ?? []

  function handleMutationSuccess() {
    router.refresh()
    setDrawer(null)
  }

  function setCalendarDate(nextDate: string) {
    const nextYear = Number(nextDate.slice(0, 4))
    if (nextYear !== model.year) {
      router.push(`/operational-calendar?year=${nextYear}`)
      return
    }
    setActiveDate(nextDate)
  }

  function shiftMonth(offset: number) {
    setCalendarDate(monthStartIso(activeYear, activeMonth + offset))
  }

  function shiftDay(offset: number) {
    setCalendarDate(addCalendarDaysIso(activeDate, offset))
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
            {model.canViewUnblinded ? (
              <Badge variant="outline" className="mt-2 border-yellow-400/50 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">
                Unblinded Access — Restricted
              </Badge>
            ) : null}
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
            <Button variant="outline" onClick={() => setDrawer({ mode: 'block' })}>
              <Ban className="size-4" />
              Block Time
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
            {(['upcoming', 'today', 'completed'] as OperationalCalendarStatus[]).map((status) => (
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
              const events = model.events.filter((event) => sameCalendarMonth(event.date, activeYear, monthIndex))
              const studies = new Set(events.map((event) => event.studyId)).size
              const blockedDays = new Set(events.filter((event) => event.kind === 'availability_block').map((event) => event.date)).size
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setActiveDate(monthStartIso(activeYear, monthIndex))
                    setView('month')
                  }}
                  className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{month}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-accent/30 p-2">
                      <p className="text-lg font-semibold">{events.length}</p>
                      <p className="text-muted-foreground">Items</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <p className="text-lg font-semibold">{blockedDays}</p>
                      <p className="text-muted-foreground">Blocked</p>
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
              {buildMonthGridDates(activeYear, activeMonth, model.siteTimeZone).map((date) => {
                const events = eventsByDate.get(date) ?? []
                const isCurrentMonth = sameCalendarMonth(date, activeYear, activeMonth)
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
                    <button
                      type="button"
                      onClick={() => setDrawer({ mode: 'block', date })}
                      className="float-right mr-1 rounded px-1 text-[10px] font-medium text-muted-foreground hover:bg-accent/30 hover:text-primary"
                    >
                      Block
                    </button>
                    <div className="space-y-1">
                      {visibleEvents.map((event) => (
                        <MonthEventButton
                          key={event.id}
                          event={event}
                          siteTimeZone={model.siteTimeZone}
                          onOpen={(item) => setDrawer({ mode: 'event', event: item })}
                        />
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
                  const isBlock = event.kind === 'availability_block'
                  return (
                    <li key={event.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <div className={`flex size-10 items-center justify-center rounded-lg ${isBlock ? 'bg-muted' : 'bg-accent/30'}`}>
                        <CalendarDays className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{isBlock ? event.visitName : event.subjectIdentifier}</p>
                          <span className={`size-2 rounded-full ${isBlock ? 'bg-muted-foreground' : statusClass(event.status)}`} />
                          <Badge variant="outline" className="capitalize">{displayEventStatus(event)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isBlock
                            ? `${formatTimeRange(event, model.siteTimeZone)} · ${event.affectedUserId ?? event.resourceName ?? event.blockScope ?? 'site'}`
                            : event.visitName}
                        </p>
                      </div>
                      {!isBlock ? (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ModalityGlyph modality={event.modality} className="size-4" />
                            <span className="capitalize">{event.modality.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <UserRound className="size-4" />
                            <span>{event.assignedCoordinator}</span>
                          </div>
                        </>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setDrawer({ mode: 'event', event })}>
                        Details
                      </Button>
                      {!isBlock && event.href ? (
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

      <EventDrawer
        state={drawer}
        model={model}
        onClose={() => setDrawer(null)}
        onNavigate={setDrawer}
        onMutationSuccess={handleMutationSuccess}
      />
    </div>
  )
}
