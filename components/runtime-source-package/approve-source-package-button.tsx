'use client'

import { useState } from 'react'

type ApproveSourcePackageButtonProps = {
  organizationId: string
  packageId: string
  disabled?: boolean
  onApproved?: () => void
}

export function ApproveSourcePackageButton({
  organizationId,
  packageId,
  disabled = false,
  onApproved,
}: ApproveSourcePackageButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/runtime-source-packages/${packageId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not approve package')
      onApproved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void handleApprove()}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? 'Approving…' : 'Approve'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
