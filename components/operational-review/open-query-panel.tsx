'use client'

import { useState } from 'react'

type ProcedureOption = {
  procedureInstanceId: string
  procedureCode: string
  procedureName: string
  fields: Array<{ field_id: string; label: string }>
}

type OpenQueryPanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  snapshotId: string
  reviewId: string | null
  procedures: ProcedureOption[]
  disabled?: boolean
  onOpened: () => void
}

export function OpenQueryPanel({
  organizationId,
  studyId,
  subjectId,
  snapshotId,
  reviewId,
  procedures,
  disabled,
  onOpened,
}: OpenQueryPanelProps) {
  const [queryScope, setQueryScope] = useState<'visit' | 'procedure' | 'field'>('field')
  const [procedureInstanceId, setProcedureInstanceId] = useState(procedures[0]?.procedureInstanceId ?? '')
  const [fieldId, setFieldId] = useState(procedures[0]?.fields[0]?.field_id ?? '')
  const [queryText, setQueryText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProcedure = procedures.find((p) => p.procedureInstanceId === procedureInstanceId)
  const selectedField = selectedProcedure?.fields.find((f) => f.field_id === fieldId)

  async function handleOpen() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/operational-review/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          subject_id: subjectId,
          snapshot_id: snapshotId,
          review_id: reviewId,
          query_scope: queryScope,
          procedure_instance_id: queryScope === 'visit' ? null : procedureInstanceId,
          procedure_code: queryScope === 'visit' ? null : selectedProcedure?.procedureCode,
          field_id: queryScope === 'field' ? fieldId : null,
          field_label: queryScope === 'field' ? selectedField?.label : null,
          query_text: queryText,
          priority: 'normal',
          assigned_role: 'crc',
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to open query')
      setQueryText('')
      onOpened()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open query')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Open query</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-xs text-slate-600">
          Scope
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
            value={queryScope}
            disabled={disabled || loading}
            onChange={(e) => setQueryScope(e.target.value as 'visit' | 'procedure' | 'field')}
          >
            <option value="visit">Visit</option>
            <option value="procedure">Procedure</option>
            <option value="field">Field</option>
          </select>
        </label>
        {queryScope !== 'visit' ? (
          <label className="text-xs text-slate-600">
            Procedure
            <select
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
              value={procedureInstanceId}
              disabled={disabled || loading}
              onChange={(e) => {
                setProcedureInstanceId(e.target.value)
                const proc = procedures.find((p) => p.procedureInstanceId === e.target.value)
                setFieldId(proc?.fields[0]?.field_id ?? '')
              }}
            >
              {procedures.map((proc) => (
                <option key={proc.procedureInstanceId} value={proc.procedureInstanceId}>
                  {proc.procedureName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {queryScope === 'field' ? (
          <label className="text-xs text-slate-600">
            Field
            <select
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
              value={fieldId}
              disabled={disabled || loading}
              onChange={(e) => setFieldId(e.target.value)}
            >
              {(selectedProcedure?.fields ?? []).map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <label className="mt-3 block text-xs text-slate-600">
        Query text
        <textarea
          className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          rows={3}
          disabled={disabled || loading}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="mt-3 rounded bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={disabled || loading || !queryText.trim()}
        onClick={() => void handleOpen()}
      >
        {loading ? 'Opening…' : 'Open query'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
