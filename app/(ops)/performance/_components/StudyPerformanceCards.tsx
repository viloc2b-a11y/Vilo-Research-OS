import Link from 'next/link'
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
  StudyPerformanceCard,
} from '@/app/(ops)/performance/_lib/performance-types'

type StudyPerformanceCardsProps = {
  cards: StudyPerformanceCard[]
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

export function StudyPerformanceCards({
  cards,
  status,
  loadFailed,
  selectedStudyName,
}: StudyPerformanceCardsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Study performance</CardTitle>
        <CardDescription>
          Enrollment, active visits, missed visits, open queries, and blocked procedures.{' '}
          {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadFailed ? (
          <p className="text-sm text-destructive">
            Study metrics are unavailable due to a query error. See the banner above.
          </p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === 'empty'
              ? 'No studies are in scope for your organization.'
              : 'No study metrics match the current filter.'}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <li key={card.studyId}>
                <StudyCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function StudyCard({ card }: { card: StudyPerformanceCard }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <Link
          href={card.href}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {card.studyName}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Status <span className="font-medium text-foreground">{card.studyStatus}</span>
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Metric label="Subjects" value={card.subjectCount} />
        <Metric label="Active visits" value={card.activeVisitCount} />
        <Metric label="Missed / OOW" value={card.missedVisitCount} highlight />
        <Metric label="Open queries" value={card.openQueryCount} />
        <Metric
          label="Blocked procedures"
          value={card.blockedProcedureCount}
          highlight={card.blockedProcedureCount > 0}
        />
      </dl>
    </div>
  )
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight && value > 0
            ? 'font-semibold text-rose-700 dark:text-rose-300'
            : 'font-semibold text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  )
}
