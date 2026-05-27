'use client'

import type { ValidationError } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-types'

export function GenerationReadinessPanel(props: {
  ready: boolean
  errors: ValidationError[]
  summary: Record<string, unknown>
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Readiness</h2>
        {props.ready ? (
          <span className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-800">Validated</span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Not ready</span>
        )}
      </div>

      <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
        {JSON.stringify(props.summary ?? {}, null, 2)}
      </pre>

      {props.errors.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-slate-700">Validation errors</p>
          <ul className="space-y-1 text-xs text-slate-700">
            {props.errors.map((err, idx) => (
              <li key={`${err.code}-${idx}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="font-mono text-[11px] text-slate-600">{err.code}</div>
                <div className="text-slate-800">{err.message}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No validation errors.</p>
      )}
    </div>
  )
}

