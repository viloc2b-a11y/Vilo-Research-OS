'use client'

import type { VisitRuntimeEventRow } from '@/lib/visit-runtime-execution/visit-runtime-types'

type VisitRuntimeEventTimelineProps = {
  events: VisitRuntimeEventRow[]
}

export function VisitRuntimeEventTimeline({ events }: VisitRuntimeEventTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No events recorded yet.</p>
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
          {Object.keys(event.eventPayload).length > 0 ? (
            <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
              {JSON.stringify(event.eventPayload, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
