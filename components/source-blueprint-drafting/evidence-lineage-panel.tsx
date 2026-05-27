'use client'

import type { DraftSuggestionPayload } from '@/lib/source-blueprint-drafting/draft-suggestion-types'

export function EvidenceLineagePanel({ payload }: { payload: DraftSuggestionPayload }) {
  return (
    <section className="rounded border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-xs font-semibold text-slate-800">Evidence lineage</h3>
      <p className="mt-1 text-xs text-slate-600">
        Evidence-backed drafting aid. No runtime changes occur automatically.
      </p>
      {payload.lineage.length ? (
        <ul className="mt-3 space-y-2">
          {payload.lineage.map((item) => (
            <li
              key={`${item.elementType}:${item.elementKey}:${item.traceOrigin}`}
              className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-600"
            >
              <div className="font-medium text-slate-800">
                {item.elementLabel || item.elementKey}
              </div>
              <div>
                {item.elementType} · {item.traceOrigin}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          No lineage rows are mapped yet for this evidence item.
        </p>
      )}
    </section>
  )
}
