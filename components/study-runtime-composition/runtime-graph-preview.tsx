'use client'

import type { StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'

type RuntimeGraphPreviewProps = {
  graph: StudyRuntimeGraphJson | null
  graphHash: string | null
}

export function RuntimeGraphPreview({ graph, graphHash }: RuntimeGraphPreviewProps) {
  if (!graph) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
        Compile the study runtime to preview the operational graph.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">Compiled runtime graph</h3>
        {graphHash ? (
          <span className="font-mono text-xs text-slate-500" title={graphHash}>
            hash {graphHash.slice(0, 12)}…
          </span>
        ) : null}
      </div>
      <div className="max-h-96 overflow-auto space-y-3">
        {graph.visits.map((visit) => (
          <div key={visit.visit_id} className="rounded border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-800">
              {visit.visit_code} · {visit.visit_name}
            </p>
            <p className="text-xs text-slate-500">
              {visit.visit_type} · day {visit.study_day ?? '—'} · modes {visit.allowed_modes.join(', ')}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {visit.procedures.map((procedure) => (
                <li key={`${visit.visit_id}-${procedure.procedure_id}-${procedure.blueprint_version_id}`}>
                  {procedure.procedure_order}. {procedure.procedure_name} ({procedure.procedure_code}) · version {procedure.blueprint_version_id.slice(0, 8)}…
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
