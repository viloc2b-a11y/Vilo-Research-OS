import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type CoordinatorSafeErrorPanelProps = {
  title?: string
  /** Optional coordinator-safe detail (never pass raw SQL / stack traces). */
  detail?: string
  retryHref?: string
  backHref?: string
  backLabel?: string
}

const DEFAULT_MESSAGE =
  "We couldn't load this section. Your work was not changed. Try again or return to the previous page."

export function CoordinatorSafeErrorPanel({
  title = 'Section unavailable',
  detail,
  retryHref,
  backHref,
  backLabel = 'Go back',
}: CoordinatorSafeErrorPanelProps) {
  return (
    <Card className="border-amber-400/40 bg-amber-50/80 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-100">
          <AlertTriangle className="size-4 flex-shrink-0" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-amber-900 dark:text-amber-100">
        <p>{DEFAULT_MESSAGE}</p>
        {detail ? <p className="text-xs text-amber-800/90 dark:text-amber-200/90">{detail}</p> : null}
        <div className="flex flex-wrap gap-2">
          {retryHref ? (
            <Link
              href={retryHref}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent',
              )}
            >
              <RotateCw className="size-3.5" />
              Try again
            </Link>
          ) : null}
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-amber-950 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-900/40"
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
