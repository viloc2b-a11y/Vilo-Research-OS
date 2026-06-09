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
  const topActions = items.slice(0, 3)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>
          The first screen for the coordinator day: top actions, why they appeared,
          and where to open context.{' '}
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
          <>
            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">Top actions</h3>
                <p className="text-xs text-muted-foreground">
                  Resolve these first to protect today&apos;s execution.
                </p>
              </div>
              <ol className="space-y-2">
                {topActions.map((item, index) => (
                  <li
                    key={`top-${item.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                          {index + 1}
                        </span>
                        {item.operationalState ? (
                          <OperationalStateBadge state={item.operationalState} />
                        ) : null}
                        <span className="font-semibold text-foreground">{item.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Priority {item.priority} · Owner {item.ownerRole}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">Reason: </span>
                        {item.reason}
                      </p>
                      {item.recommendedNextStep ? (
                        <p className="mt-1 text-xs font-medium text-foreground">
                          Recommended next step: {item.recommendedNextStep}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Linked object: {item.linkedObjectLabel}
                      </p>
                    </div>
                    <Link
                      href={item.contextHref}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Open context
                    </Link>
                  </li>
                ))}
              </ol>
            </section>

            {groups.map((group) => (
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
                        <p className="font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Priority {item.priority} · Owner {item.ownerRole}
                        </p>
                        <p className="mt-1 font-medium">
                          {item.subjectIdentifier}
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · {item.studyName}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Reason: </span>
                          {item.reason}
                        </p>
                        {item.recommendedNextStep ? (
                          <p className="mt-1 text-xs font-medium text-foreground">
                            Recommended next step: {item.recommendedNextStep}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Linked object: {item.linkedObjectLabel}
                        </p>
                      </div>
                      <Link
                        href={item.contextHref}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Open context
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
