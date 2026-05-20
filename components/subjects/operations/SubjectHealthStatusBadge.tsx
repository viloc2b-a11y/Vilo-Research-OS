import { cn } from '@/lib/utils'
import type { SubjectOperationalHealth } from '@/lib/subject/operations/types'

const tone: Record<SubjectOperationalHealth, string> = {
  healthy:
    'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200',
  attention:
    'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200',
  critical: 'bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950 dark:text-rose-200',
}

const label: Record<SubjectOperationalHealth, string> = {
  healthy: 'Operationally healthy',
  attention: 'Needs attention',
  critical: 'Critical items',
}

export function SubjectHealthStatusBadge({
  health,
  className,
}: {
  health: SubjectOperationalHealth
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tone[health],
        className,
      )}
    >
      {label[health]}
    </span>
  )
}
