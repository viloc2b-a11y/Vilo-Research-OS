import Link from 'next/link'
import { VisitCalendarRescheduleMeta } from '@/components/calendar/VisitCalendarRescheduleMeta'
import { visitOperationalDisplayDate } from '@/lib/calendar/get-active-visit-reschedule'
import { VisitActionsMenu } from '@/components/subjects/visits/VisitActionsMenu'
import {
  EdcStatusBadge,
  QcStatusBadge,
  ReviewStatusBadge,
  SubjectPaymentBadge,
  VisitStatusBadge,
} from '@/components/subjects/visits/VisitStatusBadge'
import { VisitWindowStatusBadge } from '@/components/subjects/visits/VisitWindowStatusBadge'
import { VisitRowReminderStrip } from '@/components/subjects/visits/VisitActionsMenu'
import { VisitReviewStatusBadge } from '@/components/subjects/visits/VisitReviewStatusBadge'
import { visitDetailPath } from '@/lib/subject/chart-paths'
import { formatVisitModalityLabel } from '@/lib/visits/conditional-procedures'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

function formatDate(value: string | null) {
  if (!value) return '—'
  return value
}

function ipLabel(status: SubjectVisitGridRow['ipCaptureStatus']) {
  switch (status) {
    case 'documented':
      return { label: 'IP documented', className: 'bg-emerald-100 text-emerald-900' }
    case 'incomplete':
      return { label: 'IP incomplete', className: 'bg-amber-100 text-amber-900' }
    case 'required':
      return { label: 'IP required', className: 'bg-blue-100 text-blue-900' }
    default:
      return null
  }
}

type VisitRowProps = {
  row: SubjectVisitGridRow
}

export function VisitRow({ row }: VisitRowProps) {
  const visitLabel = row.visitDay != null ? `Day ${row.visitDay}` : row.visitCode
  const hasWorkflow = row.workflow.openActions > 0 || row.workflow.overdueActions > 0
  const displayDate = visitOperationalDisplayDate({
    targetDate: row.targetDate,
    scheduledDate: row.scheduledDate,
    calendarReschedule: row.calendarReschedule,
  })
  const ip = ipLabel(row.ipCaptureStatus)

  return (
    <tr className={hasWorkflow ? 'border-b bg-amber-50/30 last:border-0 hover:bg-amber-50/50' : 'border-b last:border-0 hover:bg-muted/30'}>
      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        <Link href={visitDetailPath(row.id)} className="font-medium hover:underline">
          {row.visitName}
        </Link>
        <p className="text-xs text-muted-foreground">
          {visitLabel} · {formatVisitModalityLabel(row.modality)}
        </p>
        <div className="mt-1">
          <VisitReviewStatusBadge status={row.visitReviewStatus} />
        </div>
        {ip ? (
          <span className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs ${ip.className}`}>
            {ip.label}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2.5 align-top text-sm text-muted-foreground">
        {row.protocolLabel}
      </td>
      <td className="px-3 py-2.5 align-top text-sm">{row.arm ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm">
        <p>{formatDate(displayDate)}</p>
        {row.calendarReschedule?.isActive ? (
          <>
            <p className="text-xs text-muted-foreground">
              Protocol target {row.calendarReschedule.protocolTargetDate}
            </p>
            <VisitCalendarRescheduleMeta
              reschedule={row.calendarReschedule}
              showTargetWhenRescheduled={false}
            />
          </>
        ) : row.targetDate && row.targetDate !== row.scheduledDate ? (
          <p className="text-xs text-muted-foreground">Target {row.targetDate}</p>
        ) : null}
        {row.windowStart && row.windowEnd ? (
          <p className="text-xs text-muted-foreground">
            {row.windowStart} – {row.windowEnd}
          </p>
        ) : null}
        <div className="mt-1">
          <VisitWindowStatusBadge status={row.windowStatus} />
        </div>
        {row.completedDate ? (
          <p className="mt-1 text-xs text-muted-foreground">Done {row.completedDate}</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 align-top">
        <EdcStatusBadge status={row.edcStatus} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <QcStatusBadge status={row.qcStatus} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <ReviewStatusBadge status={row.reviewStatus} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap gap-1 text-xs">
          {row.workflow.openQueries ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{row.workflow.openQueries} queries</span>
          ) : null}
          {row.workflow.pendingSignatures ? (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-900">{row.workflow.pendingSignatures} signatures</span>
          ) : null}
          {row.workflow.overdueActions ? (
            <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">{row.workflow.overdueActions} overdue</span>
          ) : null}
          {!hasWorkflow ? <span className="text-muted-foreground">—</span> : null}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <VisitStatusBadge status={row.visitStatus} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <SubjectPaymentBadge status={row.subjectPayment} />
      </td>
      <td className="px-3 py-2.5 align-top text-right">
        <VisitActionsMenu row={row} />
        <VisitRowReminderStrip row={row} />
        {row.coordinatorNote ? (
          <p className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground" title={row.coordinatorNote}>
            {row.coordinatorNote}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
