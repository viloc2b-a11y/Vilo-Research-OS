import { cn } from '@/lib/utils'
import type { PerformanceLoadStatus, PerformanceQueryError } from '@/app/(ops)/performance/_lib/performance-types'

type PerformanceStatusBannerProps = {
  status: PerformanceLoadStatus
  errors: PerformanceQueryError[]
}

const tone: Record<PerformanceLoadStatus, string> = {
  ok: '',
  empty: 'border-border bg-muted/40 text-muted-foreground',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  partial:
    'border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
}

export function PerformanceStatusBanner({ status, errors }: PerformanceStatusBannerProps) {
  if (status === 'ok' && errors.length === 0) return null

  const headline =
    status === 'error'
      ? 'Performance data could not be loaded.'
      : status === 'partial'
        ? 'Some performance metrics could not be loaded.'
        : status === 'empty'
          ? 'No performance data is available for the current scope.'
          : null

  return (
    <div
      className={cn('rounded-lg border px-4 py-3 text-sm', tone[status])}
      role={status === 'error' ? 'alert' : 'status'}
    >
      {headline ? <p className="font-medium">{headline}</p> : null}
      {errors.length > 0 ? (
        <ul className={cn('space-y-1', headline ? 'mt-2' : '')}>
          {errors.map((err) => (
            <li key={`${err.source}-${err.message}`}>
              <span className="font-medium capitalize">{err.source.replaceAll('_', ' ')}:</span>{' '}
              {err.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
