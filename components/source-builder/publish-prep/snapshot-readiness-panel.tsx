import type { SnapshotReadinessResult } from '@/lib/protocol-intake-publish-prep/types'

export function SnapshotReadinessPanel(props: {
  readiness: SnapshotReadinessResult | null
  statusLabel: string
}) {
  const { readiness, statusLabel } = props

  if (!readiness) {
    return (
      <p className="text-sm text-muted-foreground">
        Approve the publish candidate before snapshot preparation.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{statusLabel}</p>
      <ul className="space-y-2 text-sm">
        {readiness.checks.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap justify-between gap-2 rounded border border-border px-3 py-2"
          >
            <span>{c.label}</span>
            <span
              className={
                c.status === 'pass'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-destructive'
              }
            >
              {c.status === 'pass' ? 'Pass' : 'Blocker'}
              {c.detail ? ` · ${c.detail}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {readiness.blockers.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">Blocking reasons</p>
          <ul className="mt-1 list-inside list-disc">
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
