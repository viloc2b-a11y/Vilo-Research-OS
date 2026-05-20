import { cn } from '@/lib/utils'
import type { OperationalState } from '@/lib/performance/scoring/types'

const stateTone: Record<OperationalState, string> = {
  critical: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  risk: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  watch: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  healthy: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
}

type OperationalStateBadgeProps = {
  state: OperationalState
  className?: string
}

export function OperationalStateBadge({ state, className }: OperationalStateBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        stateTone[state],
        className,
      )}
    >
      {state}
    </span>
  )
}
