'use client'

import type { VisitRuntimeSnapshotRow } from '@/lib/visit-runtime-locking/visit-locking-types'

type VisitSnapshotListProps = {
  snapshots: VisitRuntimeSnapshotRow[]
  onSelect?: (visitInstanceId: string) => void
}

export function VisitSnapshotList({ snapshots, onSelect }: VisitSnapshotListProps) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-slate-500">No locked visit snapshots for this subject.</p>
  }

  return (
    <ul className="space-y-2">
      {snapshots.map((snapshot) => (
        <li key={snapshot.id}>
          <button
            type="button"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => onSelect?.(snapshot.visitInstanceId)}
          >
            <div className="font-medium text-slate-900">
              {snapshot.snapshotJson.visit_instance.visit_code} ·{' '}
              {snapshot.snapshotJson.visit_instance.visit_name}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-500">
              {snapshot.snapshotHash.slice(0, 16)}…
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
