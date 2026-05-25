import Link from 'next/link'
import { Activity, AlertTriangle, Calendar, CalendarDays, FileText, Users, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudyOperationsPanel } from '@/components/coordinator-operations/StudyOperationsPanel'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { operationalCalendarPath } from '@/lib/ops/paths'
import { loadStudyOperationsSurface } from '@/lib/coordinator-operations'
import {
  loadStudyWorkspaceModel,
  type WorkspaceItem,
} from '@/lib/ops/workspace-read-model'

type StudyWorkspacePageProps = {
  params: Promise<{ studyId: string }>
}

function ListCard({
  title,
  icon: Icon,
  items,
  empty,
  actionHref,
  actionLabel,
}: {
  title: string
  icon: React.ElementType
  items: WorkspaceItem[]
  empty: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
          <Link href={actionHref} className="ml-auto text-xs font-medium text-primary hover:underline">
            {actionLabel}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <span className="font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default async function StudyWorkspacePage({ params }: StudyWorkspacePageProps) {
  const { studyId } = await params
  const [model, operations] = await Promise.all([
    loadStudyWorkspaceModel(studyId),
    loadStudyOperationsSurface(studyId),
  ])
  const stats: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: 'Active subjects', value: model.overview.activeSubjects, Icon: Users },
    { label: 'Upcoming visits', value: model.overview.upcomingVisits, Icon: Calendar },
    { label: 'Incomplete source', value: model.overview.incompleteSource, Icon: FileText },
    { label: 'Open tasks', value: model.overview.openTasks, Icon: Workflow },
    { label: 'Blockers', value: model.overview.blockers, Icon: AlertTriangle },
  ]

  return (
    <CoordinatorPageScroll contentClassName="p-6">
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{model.study.name}</h1>
          <p className="text-sm text-muted-foreground">
            Study operations workspace · {model.study.status ?? 'status unavailable'}
          </p>
        </div>
        <Link href={`/studies/${studyId}`} className="text-sm font-medium text-primary hover:underline">
          Open study detail
        </Link>
      </div>

      <Card className="border-primary/30 bg-accent/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="size-5 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Site calendar</p>
              <p className="text-xs text-muted-foreground">
                Cross-study operational calendar for scheduled visits and coordinator workload.
              </p>
            </div>
          </div>
          <Link
            href={operationalCalendarPath()}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Open operational calendar
          </Link>
        </CardContent>
      </Card>

      {model.unavailable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            {model.unavailable.join(' · ')}
          </CardContent>
        </Card>
      ) : null}

      <StudyOperationsPanel surface={operations} />

      <div className="grid gap-3 md:grid-cols-5">
        {stats.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <Icon className="size-5 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ListCard title="Active Subjects" icon={Users} items={model.activeSubjects} empty="No active subjects found." actionHref={`/studies/${studyId}?tab=subjects`} actionLabel="Open subjects" />
        <ListCard title="Upcoming Visits" icon={Calendar} items={model.upcomingVisits} empty="No upcoming visits found." actionHref={`/studies/${studyId}`} actionLabel="Open study" />
        <ListCard title="Source Completion Status" icon={FileText} items={model.sourceCompletion} empty="No incomplete source found." actionHref={`/studies/${studyId}`} actionLabel="Review study" />
        <ListCard title="Open Blockers / Tasks" icon={Workflow} items={model.openBlockersTasks} empty="No open blockers or tasks found." actionHref={`/studies/${studyId}`} actionLabel="Open study" />
        <ListCard title="Recent Study Events" icon={Activity} items={model.recentEvents} empty="No recent operational events found." actionHref={`/studies/${studyId}`} actionLabel="Open study" />
      </div>
    </div>
    </CoordinatorPageScroll>
  )
}
