// app/(ops)/safety/page.tsx
// Safety Intelligence — org-level adverse event and SAE tracking,
// regulatory reporting timelines, and task overdue visibility.

import { redirect } from 'next/navigation'
import { AlertTriangle, ShieldAlert, Clock, FileWarning } from 'lucide-react'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { createServerClient } from '@/lib/supabase/server'
import {
  mapSafetyEventRow,
  mapSafetyEventTaskRow,
  type SafetyEventRow,
  type SafetyEventTask,
} from '@/lib/safety-runtime/safety-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function isOverdueTask(task: SafetyEventTask): boolean {
  if (task.status === 'overdue') return true
  if (task.status === 'open') {
    const days = daysUntil(task.dueDate)
    return days !== null && days < 0
  }
  return false
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type KpiCardProps = {
  label: string
  value: number
  icon: React.ElementType
  danger?: boolean
  highlight?: boolean
}

function KpiCard({ label, value, icon: Icon, danger, highlight }: KpiCardProps) {
  const cardCls =
    danger && value > 0
      ? 'bg-red-50 border-red-200'
      : highlight && value > 0
        ? 'bg-amber-50 border-amber-200'
        : 'bg-card border-border'

  const valueCls =
    danger && value > 0
      ? 'text-red-700'
      : highlight && value > 0
        ? 'text-amber-700'
        : 'text-foreground'

  const iconCls =
    danger && value > 0
      ? 'text-red-500'
      : highlight && value > 0
        ? 'text-amber-500'
        : 'text-muted-foreground'

  return (
    <div className={`rounded-xl border p-4 ${cardCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconCls}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueCls}`}>{value}</p>
    </div>
  )
}

type EventTypeBadgeProps = { eventType: SafetyEventRow['eventType'] }

function EventTypeBadge({ eventType }: EventTypeBadgeProps) {
  if (eventType === 'sae') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
        SAE
      </span>
    )
  }
  if (eventType === 'ae') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800">
        AE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
      Unclassified
    </span>
  )
}

type ReportingDeadlineCellProps = { dateStr: string | null }

function ReportingDeadlineCell({ dateStr }: ReportingDeadlineCellProps) {
  if (!dateStr) {
    return <span className="text-muted-foreground">—</span>
  }

  const days = daysUntil(dateStr)
  const formatted = formatDate(dateStr)

  if (days !== null && days < 0) {
    return (
      <span className="text-red-600 font-semibold">
        {formatted} <span className="text-xs">(overdue)</span>
      </span>
    )
  }

  if (days !== null && days <= 3) {
    return (
      <span className="text-red-600 font-semibold">
        {formatted}{' '}
        <span className="text-xs">({days === 0 ? 'today' : `${days}d`})</span>
      </span>
    )
  }

  return <span className="text-foreground">{formatted}</span>
}

type SeverityBadgeProps = { severity: SafetyEventRow['severity'] }

function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (!severity) return <span className="text-muted-foreground text-xs">—</span>

  const cls =
    severity === 'severe'
      ? 'bg-red-100 text-red-700'
      : severity === 'moderate'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-yellow-100 text-yellow-700'

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

type EventTableProps = {
  events: SafetyEventRow[]
  studyNamesById: Record<string, string>
  openTasksByEventId: Record<string, SafetyEventTask[]>
}

function EventTable({ events, studyNamesById, openTasksByEventId }: EventTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open or under-review safety events found.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Study
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Severity
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opened
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reporting Deadline
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outcome
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open Tasks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event) => {
            const tasks = openTasksByEventId[event.id] ?? []
            const hasOverdueTasks = tasks.some(isOverdueTask)

            return (
              <tr key={event.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <EventTypeBadge eventType={event.eventType} />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                  {event.subjectId.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {studyNamesById[event.studyId] ?? '—'}
                </td>
                <td className="px-4 py-2.5">
                  <SeverityBadge severity={event.severity} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(event.openedAt)}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  <ReportingDeadlineCell dateStr={event.reportingDeadlineDate} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {event.outcome ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {tasks.length > 0 ? (
                    <span
                      className={`font-semibold text-xs ${hasOverdueTasks ? 'text-red-600' : 'text-foreground'}`}
                    >
                      {tasks.length}
                      {hasOverdueTasks && ' (overdue)'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SafetyPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (memberships.length === 0) redirect('/login')

  const organizationIds = organizationIdsFromMemberships(memberships)
  const organizationId = organizationIds[0] ?? null

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">Safety Intelligence</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()

  // Load open/under_review safety events with tasks embedded via join
  const { data: eventRows } = await supabase
    .from('safety_events')
    .select('*, safety_event_tasks(*)')
    .eq('organization_id', organizationId)
    .in('event_status', ['open', 'under_review'])
    .order('opened_at', { ascending: false })
    .limit(50)

  const rawEvents = eventRows ?? []

  // Separate joined tasks from event fields before mapping
  const openTasksByEventId: Record<string, SafetyEventTask[]> = {}
  const events: SafetyEventRow[] = rawEvents.map((raw) => {
    const { safety_event_tasks: rawTasks, ...eventFields } = raw as Record<string, unknown> & {
      safety_event_tasks: Record<string, unknown>[] | null
    }
    const tasks: SafetyEventTask[] = (rawTasks ?? []).map((t) =>
      mapSafetyEventTaskRow(t as Record<string, unknown>),
    )
    const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'overdue')
    if (openTasks.length > 0) {
      openTasksByEventId[String(eventFields.id)] = openTasks
    }
    return mapSafetyEventRow(eventFields)
  })

  // Load study names for display
  const studyIds = [...new Set(events.map((e) => e.studyId))]
  const studyNamesById: Record<string, string> = {}

  if (studyIds.length > 0) {
    const { data: studyRows } = await supabase
      .from('studies')
      .select('id, name')
      .in('id', studyIds)

    for (const s of studyRows ?? []) {
      studyNamesById[String(s.id)] = String(s.name)
    }
  }

  // Summary counts
  const totalOpen = events.length
  const totalSaes = events.filter((e) => e.eventType === 'sae').length
  const allOpenTasks = Object.values(openTasksByEventId).flat()
  const overdueTasks = allOpenTasks.filter(isOverdueTask).length

  // Sort: SAEs first, then AEs/unclassified — within each group preserve DB order (opened_at desc)
  const sortedEvents = [
    ...events.filter((e) => e.eventType === 'sae'),
    ...events.filter((e) => e.eventType !== 'sae'),
  ]

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          Safety Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          Adverse events, SAE reporting timelines, and regulatory compliance.
        </p>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Open Events"
            value={totalOpen}
            icon={FileWarning}
            highlight
          />
          <KpiCard
            label="Serious Adverse Events"
            value={totalSaes}
            icon={AlertTriangle}
            danger
          />
          <KpiCard
            label="Overdue Tasks"
            value={overdueTasks}
            icon={Clock}
            danger
          />
        </div>

        {/* Events table */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Active Safety Events
          </h2>
          <EventTable
            events={sortedEvents}
            studyNamesById={studyNamesById}
            openTasksByEventId={openTasksByEventId}
          />
        </div>
      </div>
    </div>
  )
}
