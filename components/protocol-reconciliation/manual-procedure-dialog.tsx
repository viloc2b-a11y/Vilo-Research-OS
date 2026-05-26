'use client'

import { useState } from 'react'
import type { ProtocolVisitReconciliationRow } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export function ManualProcedureDialog(props: {
  organizationId: string
  protocolVersionId: string
  visits: ProtocolVisitReconciliationRow[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [procedureName, setProcedureName] = useState('')
  const [visitReconciliationId, setVisitReconciliationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/protocol-reconciliation/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: props.organizationId,
          protocol_version_id: props.protocolVersionId,
          procedure_name: procedureName,
          visit_reconciliation_id: visitReconciliationId || null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create procedure')
      setOpen(false)
      setProcedureName('')
      props.onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create procedure')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-teal-800 hover:underline"
      >
        Add manual procedure
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium text-slate-900">Manual procedure</p>
      <div className="mt-2 grid gap-2">
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Procedure name"
          value={procedureName}
          onChange={(e) => setProcedureName(e.target.value)}
          required
        />
        <select
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={visitReconciliationId}
          onChange={(e) => setVisitReconciliationId(e.target.value)}
        >
          <option value="">Unassigned visit</option>
          {props.visits.map((visit) => (
            <option key={visit.id} value={visit.id}>
              {visit.visitCode} · {visit.visitName}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={loading} className="rounded bg-teal-700 px-2 py-1 text-xs text-white">
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </form>
  )
}
