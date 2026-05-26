'use client'

import { useState } from 'react'

type StudyBlueprintOption = {
  id: string
  procedureId: string
  blueprintVersionId: string
  procedureCode: string
  procedureName: string
  visitCode: string | null
}

type AddProcedureToVisitDialogProps = {
  organizationId: string
  studyId: string
  visitId: string
  assignments: StudyBlueprintOption[]
  nextProcedureOrder: number
  onAdded: () => void
}

export function AddProcedureToVisitDialog({
  organizationId,
  studyId,
  visitId,
  assignments,
  nextProcedureOrder,
  onAdded,
}: AddProcedureToVisitDialogProps) {
  const [open, setOpen] = useState(false)
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? '')
  const [procedureOrder, setProcedureOrder] = useState(String(nextProcedureOrder))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignmentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/study-runtime/visits/${visitId}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          study_procedure_blueprint_id: assignmentId,
          procedure_order: Number(procedureOrder),
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to add procedure')
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add procedure')
    } finally {
      setLoading(false)
    }
  }

  if (!assignments.length) {
    return <p className="text-xs text-amber-700">Assign procedure blueprints to this study first.</p>
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-indigo-600">
        Add procedure
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-2 space-y-2 rounded border border-slate-200 p-2">
      <select className="w-full rounded border px-2 py-1 text-xs" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
        {assignments.map((assignment) => (
          <option key={assignment.id} value={assignment.id}>
            {assignment.procedureName} ({assignment.procedureCode})
          </option>
        ))}
      </select>
      <input className="w-full rounded border px-2 py-1 text-xs" value={procedureOrder} onChange={(e) => setProcedureOrder(e.target.value)} placeholder="Order" />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">Cancel</button>
      </div>
    </form>
  )
}
