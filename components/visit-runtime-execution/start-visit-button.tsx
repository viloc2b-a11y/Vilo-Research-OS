'use client'

import { useState } from 'react'

type StartVisitButtonProps = {
  disabled?: boolean
  onStart: () => Promise<void>
}

export function StartVisitButton({ disabled, onStart }: StartVisitButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true)
          setError(null)
          void onStart().catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to start visit')
          }).finally(() => setLoading(false))
        }}
      >
        {loading ? 'Starting…' : 'Start visit'}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
