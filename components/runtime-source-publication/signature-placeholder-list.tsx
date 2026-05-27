'use client'

import type { RuntimeSourceSignaturePlaceholderRow } from '@/lib/runtime-source-publication/runtime-source-publication-types'

export function SignaturePlaceholderList(props: { placeholders: RuntimeSourceSignaturePlaceholderRow[] }) {
  if (props.placeholders.length === 0) {
    return <p className="text-sm text-slate-500">No signature placeholders found.</p>
  }

  return (
    <ul className="space-y-2">
      {props.placeholders.map((ph) => (
        <li key={ph.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{ph.displayLabel}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {ph.placeholderScope}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {ph.signatureMeaning}
            </span>
            <span className="text-xs text-slate-500">role: {ph.requiredRole}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Required: {ph.required ? 'yes' : 'no'} · Status: {ph.status} · Order: {ph.sequenceOrder}
          </p>
          {ph.instructions ? <p className="mt-2 text-xs text-slate-700">{ph.instructions}</p> : null}
        </li>
      ))}
    </ul>
  )
}

