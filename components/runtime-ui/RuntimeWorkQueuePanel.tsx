import type { RuntimeUiWorkQueueBucket } from '@/lib/runtime-ui/types'
import { ListTodo } from 'lucide-react'

export function RuntimeWorkQueuePanel({
  buckets,
  compact,
}: {
  buckets: RuntimeUiWorkQueueBucket[]
  compact?: boolean
}) {
  if (buckets.length === 0) return null

  return (
    <section className="vilo-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListTodo className="size-4 text-primary" />
        Coordinator work queue
        <span className="text-[10px] font-normal text-muted-foreground">(derived)</span>
      </h3>
      <div className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
        {buckets.map((bucket) => (
          <div key={bucket.bucket}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {bucket.bucket}
            </p>
            <ul className="mt-1.5 space-y-1">
              {bucket.items.map((item, i) => (
                <li
                  key={`${bucket.bucket}-${i}`}
                  className="rounded border border-border/60 px-2 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{item.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
