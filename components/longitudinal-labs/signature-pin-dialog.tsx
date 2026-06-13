'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SIGNATURE_WARNING =
  'I understand this electronic signature records my review/approval of this artifact and will be stored in the audit trail.'

export function SignaturePinDialog({
  open,
  onClose,
  organizationId,
  signatureRequestId,
}: {
  open: boolean
  onClose: () => void
  organizationId: string
  signatureRequestId: string
}) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSign() {
    setSigning(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/operational-signatures/${signatureRequestId}/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            explicit_user_action: true,
            confirmation_statement: SIGNATURE_WARNING,
            signature_pin: pin,
          }),
        },
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Signature failed')
      }

      setPin('')
      setConfirmed(false)
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature failed')
    } finally {
      setSigning(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const pinReady = pin.length === 6 && confirmed

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-foreground">
          Sign Lab Report Review
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your Signature PIN to sign this lab report review.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Signature PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digits"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\s+/g, '').trim())
              }
              autoFocus
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>{SIGNATURE_WARNING}</span>
          </label>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={signing}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={!pinReady || signing}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {signing ? 'Signing...' : 'Sign Electronically'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
