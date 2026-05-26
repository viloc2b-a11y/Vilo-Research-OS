'use client'

import type { RuntimeSourceProcedureShellRow } from '@/lib/runtime-source-package/source-package-types'

type SourceProcedureShellCardProps = {
  procedureShell: RuntimeSourceProcedureShellRow
}

export function SourceProcedureShellCard({ procedureShell }: SourceProcedureShellCardProps) {
  const fields = (procedureShell.sourceShellJson.fields as Array<{
    field_id: string
    label: string
    type: string
    required: boolean
  }>) ?? []

  return (
    <div className="rounded border border-slate-100 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-800">
          {procedureShell.procedureOrder}. {procedureShell.procedureName}
        </span>
        <span className="font-mono text-xs text-slate-500">{procedureShell.procedureCode}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{procedureShell.status}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Blueprint version {procedureShell.blueprintVersionId.slice(0, 8)}… ·{' '}
        {procedureShell.required ? 'Required' : 'Optional'}
      </p>
      {fields.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {fields.map((field) => (
            <li key={field.field_id}>
              {field.label} ({field.type}){field.required ? ' · required' : ''} · draft
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">No field shells generated.</p>
      )}
    </div>
  )
}
