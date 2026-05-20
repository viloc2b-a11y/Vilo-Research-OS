import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  PenTool,
  RotateCw,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  loadCommandCenterModel,
  type CommandCenterListItem,
} from '@/lib/ops/command-center-read-model'

function toneClass(tone: CommandCenterListItem['tone']) {
  switch (tone) {
    case 'critical':
      return 'border-destructive/30 border-l-destructive bg-destructive/10 text-destructive'
    case 'warning':
      return 'border-yellow-400/40 border-l-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100'
    case 'success':
      return 'border-primary/40 border-l-primary bg-accent/30 text-foreground'
    default:
      return 'border-border border-l-border bg-card text-foreground'
  }
}

function summaryToneClass(metric: string, value: number) {
  const problemMetric = metric !== 'today-visits'
  const criticalMetric = metric === 'blockers' || (metric === 'out-of-window' && value > 5)

  if (problemMetric && value === 0) {
    return 'border-primary/40 bg-accent/30 text-foreground hover:bg-accent/40'
  }
  if (criticalMetric && value > 0) {
    return 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
  }
  if (problemMetric && value > 0) {
    return 'border-yellow-400/50 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-100 dark:hover:bg-yellow-950/40'
  }
  return 'border-border bg-card text-foreground hover:bg-accent/20'
}

function sectionToneClass(tone: CommandCenterListItem['tone']) {
  switch (tone) {
    case 'critical':
      return 'border-t-destructive'
    case 'warning':
      return 'border-t-yellow-500'
    case 'success':
      return 'border-t-primary'
    default:
      return 'border-t-border'
  }
}

function displayEventType(type: string) {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  for (const [unit, amount] of divisions) {
    if (Math.abs(seconds) >= amount) return rtf.format(Math.round(seconds / amount), unit)
  }
  return 'just now'
}

function Section({
  id,
  title,
  icon: Icon,
  tone = 'neutral',
  items,
  empty,
  actionHref,
  actionLabel,
}: {
  id: string
  title: string
  icon: React.ElementType
  tone?: CommandCenterListItem['tone']
  items: CommandCenterListItem[]
  empty: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <Card id={id} className={`scroll-mt-6 border-t-4 ${sectionToneClass(tone)}`}>
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 text-primary" />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
          <Link href={actionHref} className="ml-auto text-xs font-medium text-primary hover:underline">
            {actionLabel}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {items.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{empty}</p>
            <Link href={actionHref} className="text-xs font-medium text-primary hover:underline">
              {actionLabel}
            </Link>
          </div>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`block rounded-md border border-l-4 px-3 py-2 text-sm transition-colors hover:bg-muted ${toneClass(item.tone)}`}
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs opacity-80">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

type CoordinatorCommandCenterPageProps = {
  searchParams: Promise<{ eventType?: string }>
}

export default async function CoordinatorCommandCenterPage({ searchParams }: CoordinatorCommandCenterPageProps) {
  const { eventType } = await searchParams
  const model = await loadCommandCenterModel()
  const selectedEventType = eventType?.trim() || 'all'
  const eventTypes = Array.from(new Set(model.recentEvents.map((event) => event.eventType))).sort()
  const visibleEvents =
    selectedEventType === 'all'
      ? model.recentEvents
      : model.recentEvents.filter((event) => event.eventType === selectedEventType)

  const summary = [
    { id: 'today-visits', label: "Today's visits", value: model.todayVisits.length, icon: Calendar, href: '#today-visits' },
    { id: 'out-of-window', label: 'Out of window', value: model.outOfWindowVisits.length, icon: AlertTriangle, href: '#out-of-window' },
    { id: 'incomplete-source', label: 'Incomplete source', value: model.incompleteSource.length, icon: FileText, href: '#incomplete-source' },
    { id: 'pending-signatures', label: 'Pending signatures', value: model.pendingSignatures.length, icon: PenTool, href: '#pending-signatures' },
    { id: 'open-workflow-tasks', label: 'Open tasks', value: model.openWorkflowTasks.length, icon: Workflow, href: '#open-workflow-tasks' },
    { id: 'blockers', label: 'Blockers', value: model.sourceEngineBlockers.length, icon: Activity, href: '#source-engine-blockers' },
  ]
  const alertSections = [
    {
      id: 'today-visits',
      title: "Today's Visits",
      icon: Calendar,
      tone: (model.todayVisits.length > 0 ? 'warning' : 'success') as CommandCenterListItem['tone'],
      empty: 'No visits scheduled for today. Review study workspaces to plan or confirm the next upcoming visit.',
      actionHref: '/studies',
      actionLabel: 'Open studies',
      items: model.todayVisits.map((visit) => ({
        id: visit.visitId,
        title: `${visit.subjectIdentifier} · ${visit.visitName}`,
        detail: `${visit.visitStatus} · ${visit.pendingProcedures} pending procedure(s)`,
        href: visit.hrefVisit,
        status: visit.visitStatus,
        tone: (visit.pendingProcedures > 0 ? 'warning' : 'neutral') as CommandCenterListItem['tone'],
      })),
    },
    {
      id: 'out-of-window',
      title: 'Visits Out Of Window',
      icon: AlertTriangle,
      tone: 'critical' as const,
      empty: 'No out-of-window visits detected.',
      actionHref: '/studies',
      actionLabel: 'Review visits',
      items: model.outOfWindowVisits,
    },
    {
      id: 'pending-signatures',
      title: 'Pending Signatures',
      icon: PenTool,
      tone: 'warning' as const,
      empty: 'No pending procedure signatures found.',
      actionHref: '/studies',
      actionLabel: 'Open studies',
      items: model.pendingSignatures,
    },
    {
      id: 'open-workflow-tasks',
      title: 'Open Workflow Tasks',
      icon: Workflow,
      tone: 'warning' as const,
      empty: 'No open workflow tasks found.',
      actionHref: '/studies',
      actionLabel: 'Open workspaces',
      items: model.openWorkflowTasks,
    },
    {
      id: 'high-risk',
      title: 'High-Risk Subjects / Studies',
      icon: Activity,
      tone: 'warning' as const,
      empty: 'No VPI high-risk queue available or no high-risk subjects.',
      actionHref: '/performance',
      actionLabel: 'Open VPI',
      items: model.highRisk,
    },
  ]
  const processSections = [
    {
      id: 'incomplete-source',
      title: 'Incomplete Source',
      icon: FileText,
      tone: 'warning' as const,
      empty: 'No incomplete source sets found.',
      actionHref: '/studies',
      actionLabel: 'Open studies',
      items: model.incompleteSource,
    },
    {
      id: 'source-engine-blockers',
      title: 'Source Engine Blockers',
      icon: Activity,
      tone: 'critical' as const,
      empty: 'No open Source Engine blockers found.',
      actionHref: '/studies',
      actionLabel: 'Review source',
      items: model.sourceEngineBlockers,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Coordinator Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Daily operating cockpit from visits, source, signatures, workflow, events, and VPI signals.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline">Real DB read model</Badge>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last updated {formatRelativeTime(model.generatedAt)}</span>
            <Link href="/command-center" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <RotateCw className="size-3" />
              Refresh
            </Link>
          </div>
        </div>
      </div>

      {model.unavailable.length > 0 ? (
        <Card className="border-yellow-400/40 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
            <AlertTriangle className="size-4 flex-shrink-0 text-yellow-700 dark:text-yellow-200" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Some sections need attention</p>
              <p className="truncate text-xs text-yellow-800 dark:text-yellow-200">
                {model.unavailable.slice(0, 2).join(' ')}
                {model.unavailable.length > 2 ? ` +${model.unavailable.length - 2} more` : ''}
              </p>
            </div>
            <Link href="/command-center" className="inline-flex items-center gap-1 rounded-md border border-yellow-400/50 bg-card px-3 py-1.5 text-xs font-medium text-yellow-900 hover:bg-yellow-100 dark:text-yellow-100 dark:hover:bg-yellow-950/40">
              <RotateCw className="size-3" />
              Retry
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summary.map(({ id, label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Card className={`min-h-28 transition-colors ${summaryToneClass(id, value)}`}>
            <CardContent className="relative flex h-full flex-col items-center justify-center px-4 py-5 text-center">
              <Icon className="absolute right-3 top-3 size-4 opacity-70" />
              <div>
                <p className="text-3xl font-semibold leading-none">{value}</p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operational Alerts</h2>
          </div>
          {alertSections.map((section) => (
            <Section key={section.id} {...section} />
          ))}
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Process Status</h2>
          </div>
          {processSections.map((section) => (
            <Section key={section.id} {...section} />
          ))}
          <Card id="recent-events" className="scroll-mt-6 border-t-4 border-t-border">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-primary" />
                Recent Operational Events
                <Badge variant="secondary">{visibleEvents.length}</Badge>
                <Link href="/studies" className="ml-auto text-xs font-medium text-primary hover:underline">
                  Open studies
                </Link>
              </CardTitle>
              {eventTypes.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/command-center#recent-events"
                    className={`rounded-full border px-2.5 py-1 text-xs ${selectedEventType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/20'}`}
                  >
                    All
                  </Link>
                  {eventTypes.slice(0, 8).map((type) => (
                    <Link
                      key={type}
                      href={`/command-center?eventType=${encodeURIComponent(type)}#recent-events`}
                      className={`rounded-full border px-2.5 py-1 text-xs ${selectedEventType === type ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/20'}`}
                    >
                      {type.replace(/_/g, ' ')}
                    </Link>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {visibleEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent operational events found.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Tipo de evento</th>
                        <th className="px-3 py-2 font-medium">Referencia</th>
                        <th className="px-3 py-2 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibleEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-accent/20">
                          <td className="max-w-[220px] px-3 py-2 font-medium text-foreground">
                            {event.href ? (
                              <Link href={event.href} className="block truncate hover:underline">
                                {displayEventType(event.eventType)}
                              </Link>
                            ) : (
                              <span className="block truncate">{displayEventType(event.eventType)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="block truncate">{event.detail}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground" title={event.occurredAt}>
                            {formatRelativeTime(event.occurredAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 text-primary" />
        Data shown is read-only and sourced from existing runtime tables; missing sections report unavailable data instead of fabricating values.
      </div>
    </div>
  )
}
