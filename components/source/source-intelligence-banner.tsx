import type {
  SourceIntelligenceReport,
  SourceIntelligenceSignalKind,
} from '@/lib/source/intelligence/compute-source-intelligence'

const KIND_ICON: Record<SourceIntelligenceSignalKind, string> = {
  missing: '⊘',
  incomplete: '◑',
  overdue: '⏱',
  inconsistent: '⚠',
}

type Props = {
  report: SourceIntelligenceReport
}

export function SourceIntelligenceBanner({ report }: Props) {
  if (report.signals.length === 0) return null

  const isBlocking = report.hasBlockers

  const containerClass = isBlocking
    ? 'rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm'
    : 'rounded-md border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-sm'

  const titleClass = isBlocking
    ? 'font-semibold text-destructive'
    : 'font-semibold text-yellow-700 dark:text-yellow-400'

  const title = isBlocking
    ? 'Source blockers detected'
    : 'Source attention required'

  return (
    <div role="alert" aria-live="polite" className={containerClass}>
      <p className={titleClass}>{title}</p>
      <ul className="mt-2 space-y-1">
        {report.signals.map((signal, i) => (
          <li key={`${signal.kind}-${signal.responseSetId ?? signal.procedureExecutionId ?? i}`} className="flex items-start gap-2 text-xs text-foreground">
            <span aria-hidden className="shrink-0 text-base leading-none">
              {KIND_ICON[signal.kind]}
            </span>
            <span>{signal.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
