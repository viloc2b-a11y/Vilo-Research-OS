import type { AdverseEventTimelineSummary } from '@/lib/subject/adverse-events/types'

type SubjectAdverseEventsSummaryProps = {
  summary: AdverseEventTimelineSummary
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'neutral' | 'watch' | 'risk' | 'muted' | 'healthy'
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

export function SubjectAdverseEventsSummary({ summary }: SubjectAdverseEventsSummaryProps) {
  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
        AE / Safety snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        Operational awareness for coordinators and investigators — not formal pharmacovigilance.
      </p>
      <div className="flex flex-wrap gap-2">
        <SummaryChip
          label="Open AE"
          value={summary.openAe}
          tone={summary.openAe > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="SAE"
          value={summary.sae}
          tone={summary.sae > 0 ? 'risk' : 'muted'}
        />
        <SummaryChip
          label="Follow-up"
          value={summary.followUpPending}
          tone={summary.followUpPending > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Recent"
          value={summary.recentlyUpdated}
          tone={summary.recentlyUpdated > 0 ? 'neutral' : 'muted'}
        />
        <SummaryChip
          label="Resolved"
          value={summary.resolved}
          tone={summary.resolved > 0 ? 'healthy' : 'muted'}
        />
      </div>
    </section>
  )
}
