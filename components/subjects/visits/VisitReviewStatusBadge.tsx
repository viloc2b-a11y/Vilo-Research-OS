import { cn } from '@/lib/utils'
import type { VisitReviewStatus } from '@/lib/subject/visits/progress-note/types'

const tones: Record<VisitReviewStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  coordinator_signed: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  investigator_signed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  reopened: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
}

const labels: Record<VisitReviewStatus, string> = {
  draft: 'Closeout draft',
  coordinator_signed: 'Coordinator signed',
  investigator_signed: 'Investigator signed',
  reopened: 'Reopened',
}

export function VisitReviewStatusBadge({ status }: { status: VisitReviewStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        tones[status],
      )}
    >
      {labels[status]}
    </span>
  )
}
