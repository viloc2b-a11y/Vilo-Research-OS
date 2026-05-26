'use client'

import type { VisitRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'

type VisitInstanceListProps = {
  instances: VisitRuntimeInstanceRow[]
  selectedId: string | null
  onSelect: (visitInstanceId: string) => void
}

export function VisitInstanceList({ instances, selectedId, onSelect }: VisitInstanceListProps) {
  if (instances.length === 0) {
    return <p className="text-sm text-slate-500">No visit workspaces yet.</p>
  }

  return (
    <ul className="space-y-2">
      {instances.map((instance) => (
        <li key={instance.id}>
          <button
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              selectedId === instance.id
                ? 'border-slate-400 bg-slate-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            onClick={() => onSelect(instance.id)}
          >
            <div className="font-medium text-slate-900">
              {instance.visitCode} · {instance.visitName}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {instance.visitStatus} · {instance.lockStatus} · {instance.progressPercent}%
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
