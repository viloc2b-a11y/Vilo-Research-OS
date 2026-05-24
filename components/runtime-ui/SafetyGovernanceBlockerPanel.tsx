import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import type { RuntimeUiBlockerRow } from '@/lib/runtime-ui/types'

function severityClass(severity: RuntimeUiBlockerRow['severity']) {
  if (severity === 'blocker') return 'border-destructive/30 bg-destructive/5'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50'
  return 'border-border bg-muted/30'
}

export function SafetyGovernanceBlockerPanel({ blockers }: { blockers: RuntimeUiBlockerRow[] }) {
  if (blockers.length === 0) return null

  return (
    <section className="vilo-card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldAlert className="size-4 text-amber-600" />
        Safety & governance blockers
      </h3>
      <ul className="space-y-2">
        {blockers.map((b) => (
          <li key={b.id} className={`rounded-md border px-3 py-2 text-xs ${severityClass(b.severity)}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{b.label}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{b.category}</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{b.detail}</p>
            {b.href ? (
              <Link href={b.href} className="mt-1 inline-block font-medium text-primary hover:underline">
                Resolve →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
