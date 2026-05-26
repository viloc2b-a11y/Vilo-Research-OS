'use client'

import type { RuntimeVisitView } from '@/lib/study-runtime-composition/runtime-composition-types'
import { AddProcedureToVisitDialog } from './add-procedure-to-visit-dialog'

type StudyBlueprintOption = {
  id: string
  procedureId: string
  blueprintVersionId: string
  procedureCode: string
  procedureName: string
  visitCode: string | null
}

type VisitCardProps = {
  visit: RuntimeVisitView
  organizationId: string
  studyId: string
  assignments: StudyBlueprintOption[]
  onChanged: () => void
}

export function VisitCard({ visit, organizationId, studyId, assignments, onChanged }: VisitCardProps) {
  const nextOrder =
    visit.procedures.reduce((max, procedure) => Math.max(max, procedure.procedureOrder), 0) + 1

  async function removeProcedure(visitProcedureId: string) {
    const params = new URLSearchParams({ organization_id: organizationId, study_id: studyId })
    const res = await fetch(
      `/api/study-runtime/visits/${visit.id}/procedures/${visitProcedureId}?${params.toString()}`,
      { method: 'DELETE' },
    )
    const data = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Failed to remove procedure')
    onChanged()
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">
            {visit.visitCode} · {visit.visitName}
          </h3>
          <p className="text-xs text-slate-500">
            {visit.visitType} · Day {visit.studyDay ?? '—'} · Window −{visit.windowBeforeDays ?? '—'} / +{visit.windowAfterDays ?? '—'} · Modes: {visit.allowedModes.join(', ')}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{visit.status}</span>
      </div>

      <div className="mt-3 space-y-2">
        {visit.procedures.length === 0 ? (
          <p className="text-xs text-slate-500">No procedures on this visit yet.</p>
        ) : (
          visit.procedures.map((procedure) => (
            <div key={procedure.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
              <span>
                {procedure.procedureOrder}. {procedure.procedureName ?? procedure.procedureId.slice(0, 8)}
                <span className="ml-1 text-slate-400">v:{procedure.blueprintVersionId.slice(0, 8)}…</span>
              </span>
              <button type="button" className="text-red-600" onClick={() => void removeProcedure(procedure.id).then(onChanged).catch(() => onChanged())}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <AddProcedureToVisitDialog
        organizationId={organizationId}
        studyId={studyId}
        visitId={visit.id}
        assignments={assignments}
        nextProcedureOrder={nextOrder}
        onAdded={onChanged}
      />
    </div>
  )
}
