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
    neutral: 'bg-white border-[#e5e5e5] text-[#10253e]',
    healthy: 'status-badge-healthy border',
    watch: 'status-badge-watch border',
    risk: 'status-badge-risk border',
    muted: 'bg-[#f0eeec] border-[#e5e5e5] text-[#98a5ad]',
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
      className="rounded-lg border bg-white p-4"
      style={{ borderColor: '#e5e5e5' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: '#10253e' }}>
        ConMeds snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: '#98a5ad' }}>
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
