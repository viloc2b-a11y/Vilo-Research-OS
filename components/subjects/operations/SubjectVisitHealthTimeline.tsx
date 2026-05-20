import Link from 'next/link'
import { VisitCalendarRescheduleMeta } from '@/components/calendar/VisitCalendarRescheduleMeta'
import type { ReactNode } from 'react'
import { VisitStatusBadge, SourceStatusBadge } from '@/components/subjects/visits/VisitStatusBadge'
import { VisitWindowStatusBadge } from '@/components/subjects/visits/VisitWindowStatusBadge'
import { subjectVisitsPath } from '@/lib/subject/chart-paths'
import type { VisitHealthTimelineItem } from '@/lib/subject/operations/types'
import type { VisitGridStatus } from '@/lib/subject/visits/types'
import { cn } from '@/lib/utils'

type SubjectVisitHealthTimelineProps = {
  items: VisitHealthTimelineItem[]
  studyId: string
  subjectId: string
  /** When false, hides link to visits grid (e.g. already on visits page). */
  showGridLink?: boolean
  /** Section title override for visits workspace. */
  title?: string
}

function timelineTone(item: VisitHealthTimelineItem): string {
  if (item.visitStatus === 'missed' || item.visitStatus === 'cancelled') {
    return 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50'
  }
  if (item.blockedProcedureCount > 0) {
    return 'border-rose-400 bg-rose-50/90 dark:border-rose-900 dark:bg-rose-950/50'
  }
  if (item.windowStatus === 'outside_window' || item.visitStatus === 'out_of_window') {
    return 'border-rose-300 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40'
  }
  if (item.windowStatus === 'warning') {
    return 'border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40'
  }
  if (item.visitStatus === 'completed') {
    return 'border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/25'
  }
  return 'border-slate-200 bg-background dark:border-slate-700'
}

function ChronologyActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

export function SubjectVisitHealthTimeline({
  items,
  studyId,
  subjectId,
  showGridLink = true,
  title = 'Visit chronology',
}: SubjectVisitHealthTimelineProps) {
  if (items.length === 0) {
    return (
      <section
        className="rounded-lg border bg-card p-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No visits on record for this subject.
        </p>
      </section>
    )
  }

  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Protocol order — completion, visit windows, source status, signatures, and open issues.
          </p>
        </div>
        {showGridLink ? (
          <Link
            href={subjectVisitsPath(studyId, subjectId)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Visits grid
          </Link>
        ) : null}
      </div>

      <ol className="relative space-y-0 border-l pl-6" style={{ borderColor: 'var(--border)' }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.visitId} className={cn('relative pb-5', isLast && 'pb-0')}>
              <span
                className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white"
                style={{ backgroundColor: 'var(--primary)' }}
                aria-hidden
              />
              <article className={cn('rounded-md border p-3 text-sm', timelineTone(item))}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={item.visitDetailHref}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {item.visitName}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {item.visitDay != null ? `Day ${item.visitDay}` : 'Visit'}
                      {item.displayDate ? ` · ${item.displayDate}` : null}
                      {item.calendarReschedule?.isActive && item.targetDate
                        ? ` · protocol target ${item.targetDate}`
                        : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <VisitWindowStatusBadge status={item.windowStatus} />
                    <VisitStatusBadge status={item.visitStatus as VisitGridStatus} />
                    <SourceStatusBadge status={item.sourceStatus} />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <ChronologyActionLink href={item.visitDetailHref}>
                    Visit workspace
                  </ChronologyActionLink>
                  {item.captureHref ? (
                    <ChronologyActionLink href={item.captureHref}>
                      Source capture
                    </ChronologyActionLink>
                  ) : null}
                  {item.reviewHref ? (
                    <ChronologyActionLink href={item.reviewHref}>
                      Source review
                    </ChronologyActionLink>
                  ) : null}
                  {item.blockedProcedureCount > 0 ? (
                    <span className="text-xs font-medium text-rose-700">
                      {item.blockedProcedureCount} blocked procedure
                      {item.blockedProcedureCount > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>

                {item.calendarReschedule?.isActive ? (
                  <VisitCalendarRescheduleMeta reschedule={item.calendarReschedule} className="mt-2" />
                ) : null}
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt style={{ color: 'var(--muted-foreground)' }}>
                      {item.calendarReschedule?.isActive ? 'Operational' : 'Scheduled'}
                    </dt>
                    <dd className="font-medium">{item.displayDate ?? item.scheduledDate ?? '—'}</dd>
                  </div>
                  {item.targetDate ? (
                    <div>
                      <dt style={{ color: 'var(--muted-foreground)' }}>Protocol target</dt>
                      <dd className="font-medium">{item.targetDate}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt style={{ color: 'var(--muted-foreground)' }}>Actual / done</dt>
                    <dd className="font-medium">{item.actualDate ?? '—'}</dd>
                  </div>
                  <div>
                    <dt style={{ color: 'var(--muted-foreground)' }}>Signatures</dt>
                    <dd className="font-medium">
                      {item.signaturesPending.length > 0
                        ? item.signaturesPending.join(', ')
                        : 'None pending'}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: 'var(--muted-foreground)' }}>Unresolved issues</dt>
                    <dd className="font-medium">
                      {item.unresolvedIssues > 0 ? item.unresolvedIssues : '—'}
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
