import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { performanceScopeDescription } from '@/app/(ops)/performance/_lib/performance-risk'
import type {
  PerformanceLoadStatus,
  VisitExecutionSnapshot,
} from '@/app/(ops)/performance/_lib/performance-types'

type VisitExecutionSnapshotProps = {
  snapshot: VisitExecutionSnapshot
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

function StatusBreakdown({
  title,
  counts,
}: {
  title: string
  counts: Record<string, number>
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No rows in scope</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {entries.map(([status, count]) => (
            <li key={status} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{status.replaceAll('_', ' ')}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function VisitExecutionSnapshot({
  snapshot,
  status,
  loadFailed,
  selectedStudyName,
}: VisitExecutionSnapshotProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit execution snapshot</CardTitle>
        <CardDescription>
          Aggregate visit, source, and review status. {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadFailed ? (
          <p className="text-sm text-destructive">
            Visit aggregates are unavailable due to a query error. See the banner above.
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Total visits tracked:</span>{' '}
              <span className="font-semibold tabular-nums">{snapshot.totalVisits}</span>
            </p>
            {snapshot.totalVisits === 0 ? (
              <p className="text-sm text-muted-foreground">
                {status === 'empty'
                  ? 'No visits are in scope.'
                  : 'No visits match the current filter.'}
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-3">
                <StatusBreakdown title="Visit status" counts={snapshot.byVisitStatus} />
                <StatusBreakdown title="Source status" counts={snapshot.bySourceStatus} />
                <StatusBreakdown title="Review status" counts={snapshot.byReviewStatus} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
