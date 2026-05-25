import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { operationalCalendarPath } from '@/lib/ops/paths'

export type CommandCenterStudyChip = {
  id: string
  name: string
  href: string
  status: string | null
}

type CommandCenterOperationsToolbarProps = {
  activeStudies: CommandCenterStudyChip[]
  todayVisitCount: number
}

export function CommandCenterOperationsToolbar({
  activeStudies,
  todayVisitCount,
}: CommandCenterOperationsToolbarProps) {
  const primaryStudy = activeStudies[0] ?? null
  const extraStudies = activeStudies.slice(1, 4)

  return (
    <nav
      id="cc-operations-toolbar"
      aria-label="Site operations shortcuts"
      className="flex max-h-[72px] min-h-[56px] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active study
        </span>
        {primaryStudy ? (
          <>
            <Link
              href={primaryStudy.href}
              className="inline-flex max-w-[min(100%,280px)] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="truncate">{primaryStudy.name}</span>
              {primaryStudy.status ? (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  — {primaryStudy.status}
                </span>
              ) : null}
            </Link>
            <Link
              href={primaryStudy.href}
              className="shrink-0 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Open study workspace
            </Link>
            {extraStudies.map((study) => (
              <Link
                key={study.id}
                href={study.href}
                className="inline-flex max-w-[200px] truncate rounded-full border border-dashed border-border px-2.5 py-1 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                title={study.name}
              >
                {study.name}
              </Link>
            ))}
            {activeStudies.length > 4 ? (
              <Link href="/studies" className="text-sm font-medium text-primary hover:underline">
                +{activeStudies.length - 4} more
              </Link>
            ) : null}
          </>
        ) : (
          <Link href="/studies" className="text-sm font-medium text-primary hover:underline">
            Open studies
          </Link>
        )}
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={operationalCalendarPath()}
          className="vilo-calendar-cta inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <span>Calendar</span>
          <span className="hidden text-sm font-normal text-muted-foreground md:inline">
            Scheduled visits &amp; workload
          </span>
        </Link>
        {todayVisitCount > 0 ? (
          <Link
            href="#today-visits"
            className="inline-flex min-h-[36px] items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Today · {todayVisitCount}
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
