'use client'

import type { ProcedureLibraryRow } from '@/lib/procedure-library/procedure-types'

type ProcedureLibraryTableProps = {
  procedures: ProcedureLibraryRow[]
  selectedId: string | null
  onSelect: (procedureId: string) => void
}

export function ProcedureLibraryTable({
  procedures,
  selectedId,
  onSelect,
}: ProcedureLibraryTableProps) {
  if (procedures.length === 0) {
    return <p className="text-sm text-slate-500">No procedures in the library yet.</p>
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Code</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Category</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Scope</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Version</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {procedures.map((procedure) => (
            <tr
              key={procedure.id}
              className={`cursor-pointer hover:bg-slate-50 ${selectedId === procedure.id ? 'bg-indigo-50' : ''}`}
              onClick={() => onSelect(procedure.id)}
            >
              <td className="px-3 py-2 font-mono text-xs">{procedure.procedureCode}</td>
              <td className="px-3 py-2 font-medium text-slate-800">{procedure.procedureName}</td>
              <td className="px-3 py-2 text-slate-600">{procedure.procedureCategory}</td>
              <td className="px-3 py-2 text-slate-600">{procedure.libraryScope}</td>
              <td className="px-3 py-2 text-slate-600">
                {procedure.activeVersionId ? 'Published' : '—'}
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{procedure.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
