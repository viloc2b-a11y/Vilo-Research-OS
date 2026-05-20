import Link from 'next/link'
import { VisitCalendarRescheduleMeta } from '@/components/calendar/VisitCalendarRescheduleMeta'
import { visitOperationalDisplayDate } from '@/lib/calendar/get-active-visit-reschedule'
import { VisitWindowStatusBadge } from '@/components/subjects/visits/VisitWindowStatusBadge'
import { VisitStatusBadge } from '@/components/subjects/visits/VisitStatusBadge'
import { cn } from '@/lib/utils'
import type { SubjectVisitGridRow, VisitGridStatus } from '@/lib/subject/visits/types'

type SubjectVisitCalendarProps = {
  visits: SubjectVisitGridRow[]
  studyId: string
  subjectId: string
}

function timelineTone(row: SubjectVisitGridRow): string {
  if (row.visitStatus === 'missed' || row.visitStatus === 'cancelled') {
    return 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50'
  }
  if (row.windowStatus === 'outside_window' || row.visitStatus === 'out_of_window') {
    return 'border-rose-300 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40'
  }
  if (row.windowStatus === 'warning') {
    return 'border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40'
  }
  return 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
}

export function SubjectVisitCalendar({ visits, studyId, subjectId }: SubjectVisitCalendarProps) {
  if (visits.length === 0) {
    return null
  }

  const timelineVisits = [...visits].sort((a, b) => {
    const da =
      visitOperationalDisplayDate({
        targetDate: a.targetDate,
        scheduledDate: a.scheduledDate,
        calendarReschedule: a.calendarReschedule,
      }) ?? ''
    const db =
      visitOperationalDisplayDate({
        targetDate: b.targetDate,
        scheduledDate: b.scheduledDate,
        calendarReschedule: b.calendarReschedule,
      }) ?? ''
    return da.localeCompare(db)
  })

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Longitudinal visit timeline</h2>
        <p className="text-xs text-muted-foreground">
          Protocol targets, scheduling windows, and operational status across all subject visits.
        </p>
      </div>
      <ol className="relative space-y-0 border-l border-muted pl-6">
        {timelineVisits.map((row, index) => {
          const displayDate = visitOperationalDisplayDate({
            targetDate: row.targetDate,
            scheduledDate: row.scheduledDate,
            calendarReschedule: row.calendarReschedule,
          })
          const orgQs = `?organization_id=${row.organizationId}`
          const href = row.primaryProcedureId
            ? `/source/capture/${row.primaryProcedureId}${orgQs}`
            : `/visits/${row.id}`
          const isLast = index === timelineVisits.length - 1

          return (
            <li key={row.id} className={cn('relative pb-6', isLast && 'pb-0')}>
              <span
                className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary"
                aria-hidden
              />
              <article
                className={cn(
                  'rounded-md border p-3 text-sm shadow-sm',
                  timelineTone(row),
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={href} className="font-medium hover:underline">
                      {row.visitName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.visitDay != null ? `Day ${row.visitDay}` : row.visitCode}
                      {displayDate ? ` · ${displayDate}` : null}
                      {row.calendarReschedule?.isActive && row.targetDate
                        ? ` · protocol target ${row.targetDate}`
                        : row.targetDate && !row.calendarReschedule?.isActive
                          ? ` · target ${row.targetDate}`
                          : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <VisitWindowStatusBadge status={row.windowStatus} />
                    <VisitStatusBadge status={row.visitStatus as VisitGridStatus} />
                  </div>
                </div>
                {row.calendarReschedule?.isActive ? (
                  <VisitCalendarRescheduleMeta
                    reschedule={row.calendarReschedule}
                    className="mt-2"
                  />
                ) : null}
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">
                      {row.calendarReschedule?.isActive ? 'Operational date' : 'Scheduled'}
                    </dt>
                    <dd className="font-medium">{displayDate ?? 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Window</dt>
                    <dd className="font-medium">
                      {row.windowStart && row.windowEnd
                        ? `${row.windowStart} – ${row.windowEnd}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="font-medium">{row.completedDate ?? '—'}</dd>
                  </div>
                </dl>
                <p className="mt-2">
                  <Link
                    href={`/studies/${studyId}/subjects/${subjectId}/visits`}
                    className="text-xs text-primary hover:underline"
                  >
                    Open visits grid
                  </Link>
                </p>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
