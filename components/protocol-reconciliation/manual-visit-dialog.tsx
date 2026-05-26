'use client'

import { useState } from 'react'

export function ManualVisitDialog(props: {
  organizationId: string
  protocolVersionId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [visitCode, setVisitCode] = useState('')
  const [visitName, setVisitName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/protocol-reconciliation/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: props.organizationId,
          protocol_version_id: props.protocolVersionId,
          visit_code: visitCode,
          visit_name: visitName,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create visit')
      setOpen(false)
      setVisitCode('')
      setVisitName('')
      props.onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit')
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
        Add manual visit
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium text-slate-900">Manual visit</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Visit code"
          value={visitCode}
          onChange={(e) => setVisitCode(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Visit name"
          value={visitName}
          onChange={(e) => setVisitName(e.target.value)}
          required
        />
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
