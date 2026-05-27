'use client'

import type { VisitSnapshotQueryEventRow } from '@/lib/operational-review/operational-review-types'

type QueryEventTimelineProps = {
  events: VisitSnapshotQueryEventRow[]
}

export function QueryEventTimeline({ events }: QueryEventTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No query events recorded yet.</p>
  }

  return (
    <ol className="space-y-2 border-l border-slate-200 pl-4">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <div className="font-medium text-slate-800">{event.eventType}</div>
          <div className="text-xs text-slate-500">
            {new Date(event.eventTimestamp).toLocaleString()} · hash{' '}
            <span className="font-mono">{event.stateHash.slice(0, 12)}…</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
