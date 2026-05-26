'use client'

import { useState } from 'react'

type LockVisitButtonProps = {
  disabled?: boolean
  onLock: (lockReason: string) => Promise<void>
}

export function LockVisitButton({ disabled, onLock }: LockVisitButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('Visit completed and reviewed')

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-600">
        Lock reason
        <input
          className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-1 text-sm"
          value={reason}
          disabled={disabled || loading}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="rounded bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={disabled || loading}
        onClick={() => {
          setLoading(true)
          setError(null)
          void onLock(reason).catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to lock visit')
          }).finally(() => setLoading(false))
        }}
      >
        {loading ? 'Locking…' : 'Lock visit'}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
