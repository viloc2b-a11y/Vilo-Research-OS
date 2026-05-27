'use client'

import type { ProtocolRuntimeGenerationRunRow } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-types'

export function GenerationRunList(props: {
  runs: ProtocolRuntimeGenerationRunRow[]
  selectedRunId: string | null
  onSelect: (runId: string) => void
}) {
  if (props.runs.length === 0) {
    return <p className="text-sm text-slate-500">No generation runs yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.runs.map((run) => {
        const selected = props.selectedRunId === run.id
        return (
          <li
            key={run.id}
            className={`group rounded border p-3 text-sm ${
              selected ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => props.onSelect(run.id)}
                className="text-left font-medium text-slate-900 hover:underline"
              >
                {run.generationStatus} · {run.id.slice(0, 8)}…
              </button>
              <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Study {run.studyId.slice(0, 8)}… · Snapshot{' '}
              {run.generatedRuntimeSnapshotId ? run.generatedRuntimeSnapshotId.slice(0, 8) : '—'}…
            </p>
            <div className="mt-2 vilo-hover-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <pre className="max-h-20 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                {JSON.stringify(run.resultSummary ?? {}, null, 2)}
              </pre>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

