'use client'

import { useState } from 'react'

type ReviewSourcePackageButtonProps = {
  organizationId: string
  packageId: string
  disabled?: boolean
  onReviewed?: () => void
}

export function ReviewSourcePackageButton({
  organizationId,
  packageId,
  disabled = false,
  onReviewed,
}: ReviewSourcePackageButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReview() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/runtime-source-packages/${packageId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not mark package reviewed')
      onReviewed?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark package reviewed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void handleReview()}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Updating…' : 'Mark reviewed'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
