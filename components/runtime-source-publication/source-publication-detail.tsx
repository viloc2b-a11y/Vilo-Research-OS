'use client'

import type { RuntimeSourcePublicationEventRow, RuntimeSourcePackagePublicationRow } from '@/lib/runtime-source-publication/runtime-source-publication-types'

export function SourcePublicationDetail(props: {
  publication: RuntimeSourcePackagePublicationRow
  events: RuntimeSourcePublicationEventRow[]
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Published source version</h2>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            v{props.publication.publicationVersion}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {props.publication.publicationStatus}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          package {props.publication.sourcePackageId.slice(0, 8)}… · hash {props.publication.packageHash}
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
          {JSON.stringify(props.publication.metadata ?? {}, null, 2)}
        </pre>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
        <p className="font-medium text-slate-900">Publication events</p>
        <div className="mt-3 vilo-scroll-contained max-h-60 overflow-y-auto">
          {props.events.length === 0 ? (
            <p className="text-xs text-slate-500">No events found.</p>
          ) : (
            <ul className="space-y-2">
              {props.events.map((event) => (
                <li key={event.id} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-700">{event.eventType}</span>
                    <span className="text-slate-500">{new Date(event.eventTimestamp).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 max-h-24 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                    {JSON.stringify(event.eventPayload ?? {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

