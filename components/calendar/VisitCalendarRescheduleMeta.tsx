import type { VisitCalendarReschedule } from '@/lib/calendar/get-active-visit-reschedule'
import { formatRescheduledLabel } from '@/lib/calendar/get-active-visit-reschedule'

type VisitCalendarRescheduleMetaProps = {
  reschedule: VisitCalendarReschedule | null | undefined
  /** Show protocol target on its own line when a reschedule is active. */
  showTargetWhenRescheduled?: boolean
  className?: string
}

export function VisitCalendarRescheduleMeta({
  reschedule,
  showTargetWhenRescheduled = true,
  className,
}: VisitCalendarRescheduleMetaProps) {
  if (!reschedule?.isActive) return null

  return (
    <div className={className}>
      {showTargetWhenRescheduled ? (
        <p className="text-xs text-muted-foreground">
          Protocol target: {reschedule.protocolTargetDate}
        </p>
      ) : null}
      <p className="text-xs font-medium text-foreground">{formatRescheduledLabel(reschedule)}</p>
      {reschedule.reason ? (
        <p className="text-xs text-muted-foreground">Reason: {reschedule.reason}</p>
      ) : null}
      {reschedule.notes ? (
        <p className="text-xs text-muted-foreground">{reschedule.notes}</p>
      ) : null}
    </div>
  )
}
