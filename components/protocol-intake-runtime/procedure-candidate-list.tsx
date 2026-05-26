'use client'

import type { ProtocolRuntimeProcedureCandidateRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function ProcedureCandidateList(props: { procedures: ProtocolRuntimeProcedureCandidateRow[] }) {
  if (props.procedures.length === 0) {
    return <p className="text-sm text-slate-500">No procedure candidates extracted yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.procedures.map((proc) => (
        <li key={proc.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{proc.procedureName}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {proc.reconciliationStatus}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Confidence {proc.confidenceScore ?? '—'} · VisitCandidate{' '}
            {proc.visitCandidateId ? proc.visitCandidateId.slice(0, 8) : '—'}…
          </p>
          {proc.extractedText ? (
            <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
              {proc.extractedText}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

