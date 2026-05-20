import { summarizeConMeds } from '@/lib/subject/clinical-profile/conmed-summary'
import type { SubjectConMed } from '@/lib/subject/clinical-profile/types'

type SubjectConMedsSummaryProps = {
  rows: SubjectConMed[]
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

export function SubjectConMedsSummary({ rows }: SubjectConMedsSummaryProps) {
  const counts = summarizeConMeds(rows)

  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
        ConMeds snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        Subject-level medication status — active therapy, discontinuations, and documentation gaps.
      </p>
      <div className="flex flex-wrap gap-2">
        <SummaryChip
          label="Active"
          value={counts.active}
          tone={counts.active > 0 ? 'healthy' : 'muted'}
        />
        <SummaryChip
          label="Discontinued"
          value={counts.discontinued}
          tone={counts.discontinued > 0 ? 'neutral' : 'muted'}
        />
        <SummaryChip
          label="On hold"
          value={counts.onHold}
          tone={counts.onHold > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Missing info"
          value={counts.missingDocumentation}
          tone={counts.missingDocumentation > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Recent changes"
          value={counts.recentChanges}
          tone={counts.recentChanges > 0 ? 'neutral' : 'muted'}
        />
      </div>
    </section>
  )
}
