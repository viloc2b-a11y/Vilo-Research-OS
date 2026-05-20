'use client'

import Link from 'next/link'
import { visitScheduleChipTone } from '@/components/subjects/visits/VisitWindowStatusBadge'
import { VisitStatusBadge } from '@/components/subjects/visits/VisitStatusBadge'
import { cn } from '@/lib/utils'
import type { SubjectVisitScheduleItem } from '@/lib/visits/types'
import type { VisitGridStatus } from '@/lib/subject/visits/types'

type VisitScheduleSelectorProps = {
  visits: SubjectVisitScheduleItem[]
  subjectVisitsHref: string
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return m && d ? `${m}/${d}` : iso
}

export function VisitScheduleSelector({ visits, subjectVisitsHref }: VisitScheduleSelectorProps) {
  if (visits.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No visits on the schedule. Enroll or randomize the subject to auto-generate protocol visits.
      </p>
    )
  }

  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Visit schedule</h2>
          <p className="text-xs text-muted-foreground">
            Navigate between subject visits. Colors reflect protocol window status.
          </p>
        </div>
        <Link href={subjectVisitsHref} className="text-xs font-medium text-primary hover:underline">
          Full calendar
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visits.map((visit) => {
          const href = visit.captureHref ?? visit.visitDetailHref
          const chip = visitScheduleChipTone({
            windowStatus: visit.windowStatus,
            visitStatus: visit.visitStatus,
            isCurrent: visit.isCurrent,
          })
          return (
            <Link
              key={visit.visitId}
              href={href}
              className={cn(
                'min-w-[9rem] shrink-0 rounded-md border px-3 py-2 text-left transition hover:opacity-90',
                chip,
              )}
              aria-current={visit.isCurrent ? 'true' : undefined}
            >
              <p className="text-xs font-semibold leading-tight">
                {visit.visitDay != null ? `Day ${visit.visitDay}` : visit.visitCode}
              </p>
              <p className="truncate text-xs opacity-90">{visit.visitName}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide opacity-80">
                Target {formatShortDate(visit.targetDate)}
              </p>
              <p className="text-[10px] opacity-80">
                Sched {formatShortDate(visit.scheduledDate)}
              </p>
              <div className="mt-1.5">
                <VisitStatusBadge status={visit.visitStatus as VisitGridStatus} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
