'use client'

import { useCallback, useEffect, useState } from 'react'

type SignatureCredentialStatus = {
  hasCredential: boolean
  active: boolean
  requiresReset: boolean
  lockedUntil: string | null
  failedAttempts: number
  pinCreatedAt: string | null
  pinUpdatedAt: string | null
  needsSetup: boolean
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export function SignatureCredentialCard() {
  const [status, setStatus] = useState<SignatureCredentialStatus | null>(null)
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsCurrentPin = Boolean(status?.hasCredential && !status?.requiresReset)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/signature-credentials', { cache: 'no-store' })
      const data = (await res.json()) as {
        ok?: boolean
        status?: SignatureCredentialStatus
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load signature credential')
      setStatus(data.status ?? null)
      setLocked(Boolean(data.status?.lockedUntil && new Date(data.status.lockedUntil).getTime() > Date.now()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signature credential')
      setLocked(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus()
  }, [loadStatus])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/signature-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          confirm_pin: confirmPin,
          current_pin: currentPin || undefined,
          action: status?.hasCredential ? 'set' : 'set',
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        status?: SignatureCredentialStatus
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save signature credential')
      setStatus(data.status ?? null)
      setLocked(Boolean(data.status?.lockedUntil && new Date(data.status.lockedUntil).getTime() > Date.now()))
      setPin('')
      setConfirmPin('')
      setCurrentPin('')
      setMessage('Signature PIN saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature credential')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Signature PIN</h2>
          <p className="mt-1 text-xs text-slate-500">
            Separate from your login password. Use a 6-digit PIN to sign operational records.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {locked ? <span className="font-medium text-amber-700">Locked</span> : 'Active'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-slate-800">
            {loading ? 'Loading…' : status?.hasCredential ? 'PIN configured' : 'PIN not set'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Failed attempts: {status?.failedAttempts ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Updated: {formatDateTime(status?.pinUpdatedAt ?? null)}
          </p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lockout</p>
          <p className="mt-1 text-slate-800">
            {locked ? `Locked until ${formatDateTime(status?.lockedUntil ?? null)}` : 'No active lock'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Reset required: {status?.requiresReset ? 'Yes' : 'No'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            New PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 digits"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\s+/g, '').trim())}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Confirm PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Repeat PIN"
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\s+/g, '').trim())}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Current PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder={status?.hasCredential ? 'Required for update' : 'Optional'}
            value={currentPin}
            onChange={(event) => setCurrentPin(event.target.value.replace(/\s+/g, '').trim())}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={
            saving ||
            pin.length !== 6 ||
            confirmPin.length !== 6 ||
            (needsCurrentPin && currentPin.length !== 6)
          }
          className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : status?.hasCredential ? 'Update PIN' : 'Set PIN'}
        </button>
        <p className="text-xs text-slate-500">The PIN is hashed server-side and never stored in plain text.</p>
      </div>

      {message ? <p className="mt-3 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
