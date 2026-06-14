import Link from 'next/link'
import { ShieldAlert, AlertTriangle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SafetyEventRow } from '@/lib/safety-runtime/safety-types'
import { subjectAdverseEventsTabPath } from '@/lib/ops/paths'

type Props = {
  events: SafetyEventRow[]
  studyId: string | null
  subjectId: string
}

const SEVERITY_CLASSES: Record<string, string> = {
  severe: 'bg-red-100 text-red-800',
  moderate: 'bg-orange-100 text-orange-800',
  mild: 'bg-yellow-100 text-yellow-800',
}

const STATUS_CLASSES: Record<string, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  under_review: 'bg-purple-50 text-purple-700 border-purple-200',
  closed: 'bg-slate-50 text-slate-500 border-slate-200',
  candidate: 'bg-slate-100 text-slate-600 border-slate-200',
}

function daysUntil(dateStr: string): number {
  const now = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const target = new Date(dateStr)
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.floor((t - now) / 86_400_000)
}

export function SubjectSafetyPanel({ events, studyId, subjectId }: Props) {
  const chartHref = subjectAdverseEventsTabPath(studyId, subjectId)
  const openCount = events.filter((e) => e.eventStatus === 'open' || e.eventStatus === 'under_review').length
  const saeCount = events.filter((e) => e.eventType === 'sae').length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-red-500" />
          Safety Events
          {openCount > 0 && (
            <Badge variant="destructive" className="text-xs">{openCount} open</Badge>
          )}
          {saeCount > 0 && (
            <Badge className="bg-red-100 text-red-800 text-xs border-0">{saeCount} SAE</Badge>
          )}
          <Link href={chartHref} className="ml-auto text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No adverse events on record for this subject.</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 5).map((event) => {
              const isOverdue = event.reportingDeadlineDate
                ? daysUntil(event.reportingDeadlineDate) < 0
                : false
              const daysLeft = event.reportingDeadlineDate
                ? daysUntil(event.reportingDeadlineDate)
                : null

              return (
                <li key={event.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${event.eventType === 'sae' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                      {event.eventType ?? 'AE?'}
                    </span>
                    {event.severity && (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${SEVERITY_CLASSES[event.severity] ?? 'bg-slate-100 text-slate-700'}`}>
                        {event.severity}
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASSES[event.eventStatus] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {event.eventStatus.replace(/_/g, ' ')}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(event.openedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{event.description}</p>
                  {event.reportingDeadlineDate && (
                    <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-600' : 'text-slate-500'}`}>
                      <Clock className="size-3" />
                      {isOverdue
                        ? `Reporting OVERDUE (${Math.abs(daysLeft ?? 0)}d ago)`
                        : daysLeft === 0
                          ? 'Reporting deadline TODAY'
                          : `Reporting due in ${daysLeft}d`}
                    </div>
                  )}
                  {/* SAE → Deviation bridge indicator */}
                  {event.eventType === 'sae' && Boolean((event.metadata as Record<string, unknown>)?.deviation_id) && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                      <AlertTriangle className="size-3" />
                      Deviation created
                    </div>
                  )}
                </li>
              )
            })}
            {events.length > 5 && (
              <li className="text-center text-xs text-muted-foreground">
                +{events.length - 5} more ·{' '}
                <Link href={chartHref} className="text-primary hover:underline">view all</Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
