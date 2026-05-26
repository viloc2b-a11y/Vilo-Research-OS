'use client'

import type { ProtocolRuntimeVisitCandidateRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function VisitCandidateList(props: { visits: ProtocolRuntimeVisitCandidateRow[] }) {
  if (props.visits.length === 0) {
    return <p className="text-sm text-slate-500">No visit candidates extracted yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.visits.map((visit) => (
        <li key={visit.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{visit.visitName}</span>
            {visit.visitCode ? (
              <span className="font-mono text-xs text-slate-500">{visit.visitCode}</span>
            ) : null}
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {visit.reconciliationStatus}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Confidence {visit.confidenceScore ?? '—'} · Section{' '}
            {visit.extractedFromSectionId ? visit.extractedFromSectionId.slice(0, 8) : '—'}…
          </p>
        </li>
      ))}
    </ul>
  )
}

