'use client'

import { useState } from 'react'

type CompleteObligationButtonProps = {
  organizationId: string
  obligationId: string
  obligationType: 'signature' | 'acknowledgement'
  onCompleted?: () => void
}

export function CompleteObligationButton({
  organizationId,
  obligationId,
  obligationType,
  onCompleted,
}: CompleteObligationButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultMeaning =
    obligationType === 'signature' ? 'Reviewed and signed off' : 'Acknowledged'

  async function handleComplete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/document-intake/obligations/${obligationId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          completion_meaning: defaultMeaning,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not complete obligation')
      onCompleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete obligation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleComplete()}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Completing…' : 'Mark complete'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
