'use client'

import { useState } from 'react'

type ResolveExpirationAlertButtonProps = {
  organizationId: string
  alertId: string
  onResolved?: () => void
}

export function ResolveExpirationAlertButton({
  organizationId,
  alertId,
  onResolved,
}: ResolveExpirationAlertButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResolve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/document-intake/expiration-alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          resolution_note: 'Renewal coordinated',
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not resolve alert')
      onResolved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve alert')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleResolve()}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Resolving…' : 'Mark resolved'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
