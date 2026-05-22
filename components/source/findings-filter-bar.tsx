import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FindingsFiltersViewModel } from '@/lib/source/read-contract/view-models'

type FindingsFilterBarProps = {
  filters: FindingsFiltersViewModel
}

export function FindingsFilterBar({ filters }: FindingsFilterBarProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Finding filters
      </p>
      <div className="flex flex-wrap gap-2">
        {filters.statusLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'rounded-md border px-2 py-1 text-xs',
              item.active
                ? 'border-primary bg-primary/10 font-medium'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.severityLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'rounded-md border px-2 py-1 text-xs',
              item.active
                ? 'border-primary bg-primary/10 font-medium'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        ))}
        {filters.clearSeverityHref ? (
          <Link
            href={filters.clearSeverityHref}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear severity
          </Link>
        ) : null}
      </div>
    </div>
  )
}
