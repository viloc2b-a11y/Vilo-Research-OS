'use client'

import type { VisitRuntimeSnapshotRow } from '@/lib/visit-runtime-locking/visit-locking-types'

type VisitSnapshotViewerProps = {
  snapshot: VisitRuntimeSnapshotRow
}

export function VisitSnapshotViewer({ snapshot }: VisitSnapshotViewerProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <h3 className="font-semibold text-slate-900">Locked snapshot</h3>
      <p className="mt-1 text-xs text-slate-500">
        Locked {new Date(snapshot.lockedAt).toLocaleString()}
        {snapshot.lockReason ? ` · ${snapshot.lockReason}` : ''}
      </p>
      <p className="mt-2 font-mono text-xs text-slate-600 break-all">
        {snapshot.snapshotHash}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-600">View snapshot JSON</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-slate-50 p-2 text-xs">
          {JSON.stringify(snapshot.snapshotJson, null, 2)}
        </pre>
      </details>
    </div>
  )
}
