import Link from 'next/link'
import type { OperationalWorkQueueBucket } from '@/lib/coordinator-operations/types'
import { OPERATIONAL_WORK_QUEUE_BUCKET } from '@/lib/coordinator-operations/constants'
import { ListTodo } from 'lucide-react'

function workQueueLabelClass(bucket: string): string {
  switch (bucket) {
    case OPERATIONAL_WORK_QUEUE_BUCKET.DO_NOW:
      return 'wq-label wq-label-do-now'
    case OPERATIONAL_WORK_QUEUE_BUCKET.BLOCKED:
      return 'wq-label wq-label-blocked'
    case OPERATIONAL_WORK_QUEUE_BUCKET.SOURCE_INCOMPLETE:
      return 'wq-label wq-label-source-incomplete'
    case OPERATIONAL_WORK_QUEUE_BUCKET.FOLLOW_UP_LATER:
      return 'wq-label wq-label-follow-up'
    case OPERATIONAL_WORK_QUEUE_BUCKET.SAFETY_GOVERNANCE:
      return 'wq-label wq-label-finding-prevention'
    default:
      return 'wq-label'
  }
}

export function OperationalWorkQueuePanel({
  buckets,
  compact,
  emptyMessage = 'No coordinator queue items from runtime projections yet. Open a visit to refresh orchestration.',
}: {
  buckets: OperationalWorkQueueBucket[]
  compact?: boolean
  emptyMessage?: string
}) {
  if (buckets.length === 0) {
    return (
      <section
        id="cc-work-queue"
        className={`rounded-lg border border-dashed border-border bg-muted/20 ${compact ? 'p-3' : 'p-4'}`}
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section id="cc-work-queue" className={`vilo-card min-w-0 w-full max-w-none ${compact ? 'p-3' : 'p-4'}`}>
      <h3 className={`flex items-center gap-2 text-sm font-semibold text-foreground ${compact ? 'mb-2' : 'mb-3'}`}>
        <ListTodo className="size-4 text-primary" />
        Coordinator work queue
        <span className="text-[10px] font-normal text-muted-foreground">(from runtime projections)</span>
      </h3>
      <div className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
        {buckets.map((bucket) => (
          <div key={bucket.bucket} className="rounded-md border border-border/60 p-3">
            <p className={workQueueLabelClass(bucket.bucket)}>
              {bucket.bucket}
            </p>
            <ul className="mt-2 space-y-1.5">
              {bucket.items.map((item, i) => (
                <li key={`${bucket.bucket}-${i}`} className="text-xs">
                  {item.href ? (
                    <Link href={item.href} className="font-medium text-primary hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{item.label}</span>
                  )}
                  {item.scopeLabel ? (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{item.scopeLabel}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
