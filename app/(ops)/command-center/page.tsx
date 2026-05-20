import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  PenTool,
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
      return 'border-red-200 bg-red-50 text-red-900'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    default:
      return 'border-border bg-card text-foreground'
  }
}

function Section({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string
  icon: React.ElementType
  items: CommandCenterListItem[]
  empty: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-[#34a090]" />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`block rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted ${toneClass(item.tone)}`}
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

export default async function CoordinatorCommandCenterPage() {
  const model = await loadCommandCenterModel()

  const summary = [
    { label: "Today's visits", value: model.todayVisits.length, icon: Calendar },
    { label: 'Out of window', value: model.outOfWindowVisits.length, icon: AlertTriangle },
    { label: 'Incomplete source', value: model.incompleteSource.length, icon: FileText },
    { label: 'Pending signatures', value: model.pendingSignatures.length, icon: PenTool },
    { label: 'Open tasks', value: model.openWorkflowTasks.length, icon: Workflow },
    { label: 'Blockers', value: model.sourceEngineBlockers.length, icon: Activity },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#10253e]">Coordinator Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Daily operating cockpit from visits, source, signatures, workflow, events, and VPI signals.
          </p>
        </div>
        <Badge variant="outline">Real DB read model</Badge>
      </div>

      {model.unavailable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-amber-900">Some data is unavailable</p>
            <ul className="mt-2 list-inside list-disc text-xs text-amber-800">
              {model.unavailable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summary.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <Icon className="size-5 text-[#34a090]" />
              <div>
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Section
          title="Today's Visits"
          icon={Calendar}
          empty="No visits scheduled for today."
          items={model.todayVisits.map((visit) => ({
            id: visit.visitId,
            title: `${visit.subjectIdentifier} · ${visit.visitName}`,
            detail: `${visit.visitStatus} · ${visit.pendingProcedures} pending procedure(s)`,
            href: visit.hrefVisit,
            status: visit.visitStatus,
            tone: visit.pendingProcedures > 0 ? 'warning' : 'neutral',
          }))}
        />
        <Section
          title="Visits Out Of Window"
          icon={AlertTriangle}
          empty="No out-of-window visits detected."
          items={model.outOfWindowVisits}
        />
        <Section
          title="Incomplete Source"
          icon={FileText}
          empty="No incomplete source sets found."
          items={model.incompleteSource}
        />
        <Section
          title="Pending Signatures"
          icon={PenTool}
          empty="No pending procedure signatures found."
          items={model.pendingSignatures}
        />
        <Section
          title="Source Engine Blockers"
          icon={Activity}
          empty="No open Source Engine blockers found."
          items={model.sourceEngineBlockers}
        />
        <Section
          title="Open Workflow Tasks"
          icon={Workflow}
          empty="No open workflow tasks found."
          items={model.openWorkflowTasks}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="High-Risk Subjects / Studies"
          icon={Activity}
          empty="No VPI high-risk queue available or no high-risk subjects."
          items={model.highRisk}
        />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-[#34a090]" />
              Recent Operational Events
              <Badge variant="secondary">{model.recentEvents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {model.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent operational events found.</p>
            ) : (
              <ul className="space-y-2">
                {model.recentEvents.map((event) => {
                  const body = (
                    <>
                      <span className="font-medium">{event.eventType}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {event.detail} · {event.occurredAt}
                      </span>
                    </>
                  )
                  return (
                    <li key={event.id} className="rounded-md border px-3 py-2 text-sm">
                      {event.href ? <Link href={event.href}>{body}</Link> : body}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 text-[#34a090]" />
        Data shown is read-only and sourced from existing runtime tables; missing sections report unavailable data instead of fabricating values.
      </div>
    </div>
  )
}
