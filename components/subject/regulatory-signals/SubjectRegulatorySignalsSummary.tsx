import type { RegulatorySignalSummary } from '@/lib/subject/regulatory-signals/types'

type SubjectRegulatorySignalsSummaryProps = {
  summary: RegulatorySignalSummary
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

export function SubjectRegulatorySignalsSummary({
  summary,
}: SubjectRegulatorySignalsSummaryProps) {
  return (
    <section
      className="rounded-lg border bg-white p-4"
      style={{ borderColor: '#e5e5e5' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: '#10253e' }}>
        Regulatory signals snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: '#98a5ad' }}>
        Operational compliance indicators — not adjudicated protocol deviations.
      </p>
      <div className="flex flex-wrap gap-2">
        <SummaryChip label="Total signals" value={summary.total} tone="neutral" />
        <SummaryChip
          label="Open"
          value={summary.openUnresolved}
          tone={summary.openUnresolved > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Missed / OOW"
          value={summary.missedOowVisits}
          tone={summary.missedOowVisits > 0 ? 'risk' : 'muted'}
        />
        <SummaryChip
          label="Blocked / incomplete"
          value={summary.blockedIncompleteProcedures}
          tone={summary.blockedIncompleteProcedures > 0 ? 'risk' : 'muted'}
        />
        <SummaryChip
          label="Findings"
          value={summary.unresolvedFindings}
          tone={summary.unresolvedFindings > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Overdue actions"
          value={summary.overdueActions}
          tone={summary.overdueActions > 0 ? 'risk' : 'muted'}
        />
      </div>
    </section>
  )
}
