'use client'

import { useState } from 'react'

export function GenerateRuntimeButton(props: {
  organizationId: string
  protocolVersionId: string
  studyId: string
  disabled?: boolean
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/protocol-runtime-generation/generate/${encodeURIComponent(props.protocolVersionId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: props.organizationId,
            study_id: props.studyId,
          }),
        },
      )
      const data = (await res.json()) as { error?: string; runtime_snapshot_id?: string }
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMessage(`Generated composition snapshot ${data.runtime_snapshot_id?.slice(0, 8) ?? '—'}…`)
      props.onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={props.disabled || loading}
        onClick={() => void handleGenerate()}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate study runtime'}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

