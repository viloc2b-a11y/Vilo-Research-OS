import { cn } from '@/lib/utils'
import type { VisitWindowStatus } from '@/lib/subject/visits/types'

const tone: Record<VisitWindowStatus, string> = {
  inside_window:
    'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200',
  warning:
    'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200',
  outside_window:
    'bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950 dark:text-rose-200',
}

const label: Record<VisitWindowStatus, string> = {
  inside_window: 'In window',
  warning: 'Window closing',
  outside_window: 'Out of window',
}

export function VisitWindowStatusBadge({
  status,
  className,
}: {
  status: VisitWindowStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone[status],
        className,
      )}
    >
      {label[status]}
    </span>
  )
}

export function visitScheduleChipTone(input: {
  windowStatus: VisitWindowStatus
  visitStatus: string
  isCurrent: boolean
}): string {
  if (input.isCurrent) {
    return 'ring-2 ring-primary border-primary bg-primary/5'
  }
  if (input.visitStatus === 'missed' || input.visitStatus === 'cancelled') {
    return 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
  }
  switch (input.windowStatus) {
    case 'outside_window':
      return 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
    default:
      return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
  }
}
