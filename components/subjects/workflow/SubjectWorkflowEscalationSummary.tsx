import type { WorkflowEscalationSummary } from '@/lib/subject/workflow-escalation/types'

type SubjectWorkflowEscalationSummaryProps = {
  summary: WorkflowEscalationSummary
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'neutral' | 'watch' | 'risk' | 'muted'
}) {
  const toneClass = {
    neutral: 'bg-white border-[#e5e5e5] text-[#10253e]',
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

export function SubjectWorkflowEscalationSummary({
  summary,
}: SubjectWorkflowEscalationSummaryProps) {
  return (
    <section
      className="rounded-lg border bg-white p-4"
      style={{ borderColor: '#e5e5e5' }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: '#10253e' }}>
        Escalation snapshot
      </h2>
      <p className="text-xs mb-3" style={{ color: '#98a5ad' }}>
        Who needs to do what next — operational tasks, not regulatory deviation adjudication.
      </p>
      <div className="flex flex-wrap gap-2">
        <SummaryChip label="Open items" value={summary.totalOpen} tone="neutral" />
        <SummaryChip
          label="Overdue"
          value={summary.overdue}
          tone={summary.overdue > 0 ? 'risk' : 'muted'}
        />
        <SummaryChip
          label="High priority"
          value={summary.highPriority}
          tone={summary.highPriority > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Signatures"
          value={summary.pendingSignatures}
          tone={summary.pendingSignatures > 0 ? 'watch' : 'muted'}
        />
        <SummaryChip
          label="Findings"
          value={summary.unresolvedFindings}
          tone={summary.unresolvedFindings > 0 ? 'watch' : 'muted'}
        />
      </div>
    </section>
  )
}
