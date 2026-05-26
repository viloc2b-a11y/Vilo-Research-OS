'use client'

import { useState } from 'react'
import type { ProcedureLibraryRow } from '@/lib/procedure-library/procedure-types'

type StudyOption = { id: string; name: string }

type AssignBlueprintDialogProps = {
  organizationId: string
  procedure: ProcedureLibraryRow
  studies: StudyOption[]
  onAssigned: () => void
}

export function AssignBlueprintDialog({
  organizationId,
  procedure,
  studies,
  onAssigned,
}: AssignBlueprintDialogProps) {
  const [open, setOpen] = useState(false)
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '')
  const [visitCode, setVisitCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!procedure.activeVersionId) {
    return (
      <p className="text-xs text-amber-700">Publish a blueprint version before assigning to a study.</p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/study-procedure-blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          procedure_id: procedure.id,
          blueprint_version_id: procedure.activeVersionId,
          visit_code: visitCode || null,
          required: true,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to assign blueprint')
      setOpen(false)
      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Assign to study
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-2 space-y-2 rounded border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">Assign to study</p>
      <select
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={studyId}
        onChange={(e) => setStudyId(e.target.value)}
      >
        {studies.map((study) => (
          <option key={study.id} value={study.id}>
            {study.name}
          </option>
        ))}
      </select>
      <input
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Visit code (optional)"
        value={visitCode}
        onChange={(e) => setVisitCode(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Assigning…' : 'Assign'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  )
}
