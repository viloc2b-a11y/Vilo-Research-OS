'use client'

import { useState } from 'react'
import {
  buildFieldSchemaFromBlueprint,
  buildMinimalBlueprint,
  type CreateProcedureInput,
} from '@/lib/procedure-library/procedure-types'

type CreateProcedureDialogProps = {
  organizationId: string
  onCreated: () => void
}

export function CreateProcedureDialog({ organizationId, onCreated }: CreateProcedureDialogProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('assessment')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const blueprint = buildMinimalBlueprint('main', name || 'Procedure', [
      { field_id: 'completed', type: 'yes_no', required: true, label: 'Completed' },
    ])

    const payload: CreateProcedureInput = {
      library_scope: 'organization',
      organization_id: organizationId,
      procedure_code: code,
      procedure_name: name,
      procedure_category: category,
      operational_description: `Operational workflow for ${name}.`,
    }

    try {
      const createRes = await fetch('/api/procedure-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const createData = (await createRes.json()) as { procedure?: { id: string }; error?: string }
      if (!createRes.ok || !createData.procedure) {
        throw new Error(createData.error || 'Failed to create procedure')
      }

      const versionRes = await fetch(`/api/procedure-library/${createData.procedure.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprint_json: blueprint,
          field_schema: buildFieldSchemaFromBlueprint(blueprint),
          dependency_schema: {},
        }),
      })
      const versionData = (await versionRes.json()) as { version?: { id: string }; error?: string }
      if (!versionRes.ok || !versionData.version) {
        throw new Error(versionData.error || 'Failed to create initial blueprint version')
      }

      const publishRes = await fetch(`/api/procedure-library/${createData.procedure.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionData.version.id }),
      })
      const publishData = (await publishRes.json()) as { error?: string }
      if (!publishRes.ok) throw new Error(publishData.error || 'Failed to publish blueprint')

      setOpen(false)
      setCode('')
      setName('')
      onCreated()
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
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        New procedure
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3"
    >
      <h3 className="font-semibold text-slate-800">Create reusable procedure</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Procedure code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Procedure name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create & publish v1'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
