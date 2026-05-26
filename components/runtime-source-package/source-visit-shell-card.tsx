'use client'

import type {
  RuntimeSourceProcedureShellRow,
  RuntimeSourceVisitShellRow,
} from '@/lib/runtime-source-package/source-package-types'
import { SourceProcedureShellCard } from './source-procedure-shell-card'

type SourceVisitShellCardProps = {
  visitShell: RuntimeSourceVisitShellRow
  procedureShells: RuntimeSourceProcedureShellRow[]
}

export function SourceVisitShellCard({ visitShell, procedureShells }: SourceVisitShellCardProps) {
  const visitProcedures = procedureShells
    .filter((shell) => shell.visitShellId === visitShell.id)
    .sort((a, b) => a.procedureOrder - b.procedureOrder)

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-800">
          {visitShell.visitCode} · {visitShell.visitName}
        </h3>
        <span className="text-xs text-slate-500">{visitShell.visitType}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{visitShell.status}</span>
      </div>
      <div className="space-y-2">
        {visitProcedures.length === 0 ? (
          <p className="text-xs text-slate-500">No procedure shells on this visit.</p>
        ) : (
          visitProcedures.map((procedureShell) => (
            <SourceProcedureShellCard key={procedureShell.id} procedureShell={procedureShell} />
          ))
        )}
      </div>
    </div>
  )
}
