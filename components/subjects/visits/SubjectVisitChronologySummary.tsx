import type { ValidationIssueItem } from '@/lib/subject/operations/types'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

type ChronologyCounts = {
  scheduled: number
  completed: number
  missed: number
  outOfWindow: number
  sourcePending: number
  blocked: number
}

function countChronology(visits: SubjectVisitGridRow[]): ChronologyCounts {
  let scheduled = 0
  let completed = 0
  let missed = 0
  let outOfWindow = 0
  let sourcePending = 0

  for (const v of visits) {
    if (v.visitStatus === 'completed') completed += 1
    else if (v.visitStatus === 'missed' || v.visitStatus === 'cancelled') missed += 1
    else if (
      v.visitStatus === 'out_of_window' ||
      v.windowStatus === 'outside_window'
    ) {
      outOfWindow += 1
    } else if (
      v.visitStatus === 'scheduled' ||
      v.visitStatus === 'confirmed' ||
      v.visitStatus === 'in_progress'
    ) {
      scheduled += 1
    }

    if (v.sourceStatus === 'not_started' || v.sourceStatus === 'draft') {
      sourcePending += 1
    }
  }

  return { scheduled, completed, missed, outOfWindow, sourcePending, blocked: 0 }
}

type SubjectVisitChronologySummaryProps = {
  visits: SubjectVisitGridRow[]
  validationIssues: ValidationIssueItem[]
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'neutral' | 'healthy' | 'watch' | 'risk' | 'muted'
}) {
  const toneClass = {
    neutral: 'bg-card border-border text-foreground',
    healthy: 'status-badge-healthy border',
    watch: 'status-badge-watch border',
    risk: 'status-badge-risk border',
    muted: 'bg-muted border-border text-muted-foreground',
  }[tone]

  return (
    <div className={`rounded-lg px-3 py-2 border text-center min-w-[5.5rem] ${toneClass}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] mt-1 uppercase tracking-wide opacity-80">{label}</p>
    </div>
  )
}

export function SubjectVisitChronologySummary({
  visits,
  validationIssues,
}: SubjectVisitChronologySummaryProps) {
  const counts = countChronology(visits)
  counts.blocked = validationIssues.filter((i) => i.kind === 'blocked').length

  if (visits.length === 0) return null

  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
        Operational snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        Longitudinal trajectory across protocol visits — schedule, completion, windows, and source.
      </p>
      <div className="flex flex-wrap gap-2">
        <SummaryChip label="Scheduled" value={counts.scheduled} tone="neutral" />
        <SummaryChip label="Completed" value={counts.completed} tone="healthy" />
        <SummaryChip label="Missed" value={counts.missed} tone={counts.missed > 0 ? 'risk' : 'muted'} />
        <SummaryChip
          label="Out of window"
          value={counts.outOfWindow}
          tone={counts.outOfWindow > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Source pending"
          value={counts.sourcePending}
          tone={counts.sourcePending > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Blocked"
          value={counts.blocked}
          tone={counts.blocked > 0 ? 'risk' : 'muted'}
        />
      </div>
    </section>
  )
}
