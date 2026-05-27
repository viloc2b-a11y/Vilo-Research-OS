'use client'

import type { ProtocolRuntimeGenerationRunRow } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-types'

export function GenerationResultSummary(props: { run: ProtocolRuntimeGenerationRunRow }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Latest result</h2>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {props.run.generationStatus}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Snapshot {props.run.generatedRuntimeSnapshotId ? props.run.generatedRuntimeSnapshotId.slice(0, 8) : '—'}… ·
        Generated {props.run.generatedAt ? new Date(props.run.generatedAt).toLocaleString() : '—'}
      </p>
      <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
        {JSON.stringify(props.run.resultSummary ?? {}, null, 2)}
      </pre>
    </div>
  )
}

