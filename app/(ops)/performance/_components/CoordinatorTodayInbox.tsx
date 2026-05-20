import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { OperationalStateBadge } from '@/app/(ops)/performance/_components/OperationalStateBadge'
import { performanceScopeDescription } from '@/app/(ops)/performance/_lib/performance-risk'
import type {
  PerformanceLoadStatus,
  SubjectRiskQueueItem,
} from '@/app/(ops)/performance/_lib/performance-types'
import { groupRiskQueueByOperationalState } from '@/lib/performance/portfolio'
import { recommendedActionLabel } from '@/lib/performance/scoring/recommended-actions'

type CoordinatorTodayInboxProps = {
  items: SubjectRiskQueueItem[]
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

export function CoordinatorTodayInbox({
  items,
  status,
  loadFailed,
  selectedStudyName,
}: CoordinatorTodayInboxProps) {
  const groups = groupRiskQueueByOperationalState(items)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>
          Coordinator inbox — grouped by operational state.{' '}
          {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadFailed ? (
          <p className="text-sm text-destructive">
            Inbox data is unavailable due to a query error.
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === 'empty'
              ? 'No subjects or visits are in scope.'
              : 'Nothing requires coordinator action in the current scope.'}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.state} className="space-y-2">
              <div className="flex items-center gap-2">
                <OperationalStateBadge state={group.state} />
                <span className="text-xs text-muted-foreground">
                  {group.items.length} item{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {item.subjectIdentifier}
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          · {item.studyName}
                        </span>
                      </p>
                      <p className="text-muted-foreground">{item.detail}</p>
                      {item.recommendedAction ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recommendedActionLabel(item.recommendedAction)}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={item.contextHref}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  )
}
