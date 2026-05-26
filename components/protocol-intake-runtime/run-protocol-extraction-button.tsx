'use client'

import { useState } from 'react'

export function RunProtocolExtractionButton(props: {
  organizationId: string
  versionId: string
  disabled?: boolean
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/protocol-intake-runtime/versions/${encodeURIComponent(props.versionId)}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: props.organizationId }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to run extraction')
      props.onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run extraction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        className="rounded bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={props.disabled || loading}
        onClick={() => void run()}
      >
        {loading ? 'Extracting…' : 'Run extraction'}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

