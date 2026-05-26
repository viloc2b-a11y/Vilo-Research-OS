'use client'

import { useState } from 'react'

type CompleteVisitButtonProps = {
  disabled?: boolean
  onComplete: () => Promise<void>
}

export function CompleteVisitButton({ disabled, onComplete }: CompleteVisitButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true)
          setError(null)
          void onComplete().catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to complete visit')
          }).finally(() => setLoading(false))
        }}
      >
        {loading ? 'Completing…' : 'Complete visit'}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
