'use client'

import { useEffect, useState } from 'react'
import type { ProcedureLibraryRow } from '@/lib/procedure-library/procedure-types'
import type { UpdateProcedureMappingInput } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export function MappingEditor(props: {
  organizationId: string
  procedureReconciliationId: string
  selectedProcedureId: string
  onSaved: () => void
}) {
  const [library, setLibrary] = useState<ProcedureLibraryRow[]>([])
  const [procedureId, setProcedureId] = useState(props.selectedProcedureId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(
        `/api/procedure-library?organization_id=${encodeURIComponent(props.organizationId)}&status=active&library_scope=all`,
      )
      const data = (await res.json()) as { procedures?: ProcedureLibraryRow[] }
      if (!cancelled) setLibrary(data.procedures ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.organizationId])

  async function saveMapping() {
    if (!procedureId) return
    setLoading(true)
    setError(null)
    const body: UpdateProcedureMappingInput = {
      organization_id: props.organizationId,
      matched_procedure_library_id: procedureId,
    }
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/procedures/${encodeURIComponent(props.procedureReconciliationId)}/mapping`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to save mapping')
      props.onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <select
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        value={procedureId}
        onChange={(e) => setProcedureId(e.target.value)}
      >
        <option value="">Select procedure library entry</option>
        {library.map((item) => (
          <option key={item.id} value={item.id}>
            {item.procedureCode} · {item.procedureName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={loading || !procedureId}
        onClick={() => void saveMapping()}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
      >
        Save blueprint mapping
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
