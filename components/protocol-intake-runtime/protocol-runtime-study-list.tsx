'use client'

import type { ProtocolRuntimeStudyRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function ProtocolRuntimeStudyList(props: {
  studies: ProtocolRuntimeStudyRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (props.studies.length === 0) {
    return <p className="text-sm text-slate-500">No protocol runtime studies yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.studies.map((study) => (
        <li key={study.id}>
          <button
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              props.selectedId === study.id
                ? 'border-slate-400 bg-slate-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            onClick={() => props.onSelect(study.id)}
          >
            <div className="font-medium text-slate-900">{study.protocolNumber}</div>
            <div className="mt-1 text-xs text-slate-500">{study.protocolTitle}</div>
            <div className="mt-1 text-xs text-slate-500">{study.protocolStatus}</div>
          </button>
        </li>
      ))}
    </ul>
  )
}

