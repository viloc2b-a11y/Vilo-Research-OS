import Link from 'next/link'
import { formatRescheduledLabel } from '@/lib/calendar/get-active-visit-reschedule'
import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SubjectHealthStatusBadge } from '@/components/subjects/operations/SubjectHealthStatusBadge'
import { SubjectVisitHealthTimeline } from '@/components/subjects/operations/SubjectVisitHealthTimeline'
import { VisitWindowStatusBadge } from '@/components/subjects/visits/VisitWindowStatusBadge'
import { subjectChartTabPath, subjectVisitsPath } from '@/lib/subject/chart-paths'
import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import {
  applyVisibleCap,
  COMMAND_CENTER_SIGNATURES_VISIBLE,
  COMMAND_CENTER_VALIDATION_VISIBLE,
} from '@/lib/subject/signal-density'
import { SignalListOverflow } from '@/components/subject/signal-density/SignalListOverflow'

type SubjectOperationalCommandCenterProps = {
  intelligence: SubjectOperationalIntelligence
  studyId: string
  subjectId: string
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      {children}
    </Link>
  )
}

export function SubjectOperationalCommandCenter({
  intelligence,
  studyId,
  subjectId,
}: SubjectOperationalCommandCenterProps) {
  const visitsHref = subjectVisitsPath(studyId, subjectId)
  const workflowHref = subjectChartTabPath(studyId, subjectId, 'workflow')
  const signatureCap = applyVisibleCap(
    intelligence.pendingSignatures,
    COMMAND_CENTER_SIGNATURES_VISIBLE,
  )
  const validationCap = applyVisibleCap(
    intelligence.validationIssues,
    COMMAND_CENTER_VALIDATION_VISIBLE,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Operational status</h2>
          <p className="text-xs text-muted-foreground">
            {intelligence.healthReasons.join(' · ')}
          </p>
        </div>
        <SubjectHealthStatusBadge health={intelligence.health} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming visits</CardTitle>
            <CardDescription>Schedule, windows, reminders, overdue scheduling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {intelligence.upcomingVisits.length === 0 ? (
              <EmptyLine>No upcoming or at-risk visits.</EmptyLine>
            ) : (
              intelligence.upcomingVisits.map((v) => (
                <ActionLink key={v.visitId} href={v.href}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {v.visitDay != null ? `Day ${v.visitDay}` : v.visitName} — {v.visitName}
                    </span>
                    <VisitWindowStatusBadge status={v.windowStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target {v.targetDate ?? '—'} · Sched {v.scheduledDate ?? 'not set'}
                    {v.windowStart && v.windowEnd ? ` · Window ${v.windowStart}–${v.windowEnd}` : ''}
                  </p>
                  {v.calendarReschedule?.isActive ? (
                    <p className="text-xs font-medium text-foreground">
                      {formatRescheduledLabel(v.calendarReschedule)}
                    </p>
                  ) : null}
                  {v.isOverdueScheduling ? (
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      Overdue scheduling — assign date before window closes
                    </p>
                  ) : null}
                  {v.reminderStatus === 'pending' ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Reminder pending (within 2 days)
                    </p>
                  ) : null}
                </ActionLink>
              ))
            )}
            <p className="pt-2 text-xs">
              <Link href={visitsHref} className="text-primary hover:underline">
                Open visits grid
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending actions</CardTitle>
            <CardDescription>Queries, corrections, follow-ups, escalations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {intelligence.pendingActions.length === 0 ? (
              <EmptyLine>No open workflow actions.</EmptyLine>
            ) : (
              intelligence.pendingActions.map((a) => (
                <ActionLink key={a.id} href={a.href}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {a.kind.replace(/_/g, ' ')}: {a.title}
                    </span>
                    {a.isOverdue ? (
                      <span className="text-xs font-medium text-rose-600">Overdue</span>
                    ) : null}
                  </div>
                  {a.dueDate ? (
                    <p className="text-xs text-muted-foreground">Due {a.dueDate}</p>
                  ) : null}
                </ActionLink>
              ))
            )}
            <p className="pt-2 text-xs">
              <Link href={workflowHref} className="text-primary hover:underline">
                Open workflow tab
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending signatures</CardTitle>
            <CardDescription>Coordinator, investigator, and workflow requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {intelligence.pendingSignatures.length === 0 ? (
              <EmptyLine>No pending signatures.</EmptyLine>
            ) : (
              <>
                {signatureCap.visible.map((s) => (
                  <ActionLink key={s.id} href={s.href}>
                    <span className="font-medium capitalize">{s.kind}</span>
                    {s.visitName ? (
                      <span className="text-muted-foreground"> · {s.visitName}</span>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </ActionLink>
                ))}
                <SignalListOverflow
                  hiddenCount={signatureCap.hiddenCount}
                  moreHref={workflowHref}
                  label="Open workflow tab"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Validation issues</CardTitle>
            <CardDescription>Blocked validation, incomplete procedures, critical findings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {intelligence.validationIssues.length === 0 ? (
              <EmptyLine>No blocking validation issues.</EmptyLine>
            ) : (
              <>
                {validationCap.visible.map((issue) => (
                  <ActionLink key={issue.id} href={issue.href}>
                    <span className="font-medium capitalize">{issue.kind}</span>
                    {issue.visitName ? (
                      <span className="text-muted-foreground"> · {issue.visitName}</span>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{issue.label}</p>
                  </ActionLink>
                ))}
                <SignalListOverflow
                  hiddenCount={validationCap.hiddenCount}
                  moreHref={workflowHref}
                  label="Open workflow tab"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SubjectVisitHealthTimeline items={intelligence.visitTimeline} studyId={studyId} subjectId={subjectId} />
    </div>
  )
}
