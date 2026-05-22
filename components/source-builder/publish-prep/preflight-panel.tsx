import { Badge } from '@/components/ui/badge'
import type { PreflightCheck, PreflightResult } from '@/lib/protocol-intake-publish-prep/types'

export function PreflightPanel(props: {
  preflight: PreflightResult | null
  statusLabel: string
}) {
  const { preflight, statusLabel } = props

  if (!preflight) {
    return (
      <p className="text-sm text-muted-foreground">
        No approved draft — complete intake review (12D) before publish preparation.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preflight.passed ? 'default' : 'destructive'}>
          {statusLabel}
        </Badge>
        {preflight.passed ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            Preflight passed — you may create a publish candidate.
          </span>
        ) : (
          <span className="text-sm text-destructive">
            Preflight blocked — resolve blockers below.
          </span>
        )}
      </div>

      <ul className="space-y-2 text-sm">
        {preflight.checks.map((c) => (
          <PreflightRow key={c.id} check={c} />
        ))}
      </ul>

      {preflight.blockers.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Blocking reasons</p>
          <ul className="mt-1 list-inside list-disc text-destructive/90">
            {preflight.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preflight.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">Warnings</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {preflight.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function PreflightRow({ check }: { check: PreflightCheck }) {
  const tone =
    check.status === 'pass'
      ? 'text-emerald-700 dark:text-emerald-400'
      : check.blocker
        ? 'text-destructive'
        : 'text-amber-800 dark:text-amber-200'
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded border border-border px-3 py-2">
      <span className="font-medium">{check.label}</span>
      <span className={`text-xs ${tone}`}>
        {check.status === 'pass' ? 'Pass' : check.blocker ? 'Blocker' : 'Warning'}
        {check.detail ? ` · ${check.detail}` : ''}
      </span>
    </li>
  )
}
