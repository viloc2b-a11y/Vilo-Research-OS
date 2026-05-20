import {
  CLOSEOUT_EVENT_LABELS,
  type VisitCloseoutEventRow,
} from '@/lib/subject/visits/progress-note/events'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

type VisitCloseoutTimelineProps = {
  events: VisitCloseoutEventRow[]
}

export function VisitCloseoutTimeline({ events }: VisitCloseoutTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No closeout events recorded yet. Saving the progress note or signing will appear here.
      </p>
    )
  }

  return (
    <ol className="relative space-y-0 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="pb-4 last:pb-0">
          <span className="absolute -left-1.5 mt-1.5 size-2.5 rounded-full bg-primary" />
          <p className="text-sm font-medium">{CLOSEOUT_EVENT_LABELS[event.eventType]}</p>
          <p className="text-xs text-muted-foreground">
            {formatWhen(event.eventAt)}
            {event.actorName ? ` · ${event.actorName}` : ''}
          </p>
          {event.reopenReason ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Reason: {event.reopenReason}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
