'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { sendVisitReminderAction } from '@/lib/visits/actions'

type VisitReminderActionsProps = {
  visitId: string
  organizationId: string
}

export function VisitReminderActions({ visitId, organizationId }: VisitReminderActionsProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // F-05 fix: inline notes state instead of window.prompt
  const [showPhoneNotes, setShowPhoneNotes] = useState(false)
  const [phoneNotes, setPhoneNotes] = useState('')

  const runSms = () => {
    setMessage(null)
    setShowPhoneNotes(false)
    startTransition(async () => {
      const result = await sendVisitReminderAction({
        visitId,
        organizationId,
        reminderType: 'sms',
      })
      setMessage(result.ok ? 'SMS reminder logged.' : (result.error ?? 'Failed'))
    })
  }

  const runPhone = (notes?: string) => {
    setShowPhoneNotes(false)
    setMessage(null)
    startTransition(async () => {
      const result = await sendVisitReminderAction({
        visitId,
        organizationId,
        reminderType: 'phone',
        notes: notes?.trim() || undefined,
      })
      setMessage(result.ok ? 'Phone reminder logged.' : (result.error ?? 'Failed'))
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={runSms}
        >
          Log SMS reminder
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setShowPhoneNotes((v) => !v)}
        >
          Log phone reminder
        </Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>

      {/* F-05: inline form instead of window.prompt for phone notes */}
      {showPhoneNotes ? (
        <div className="rounded-md border bg-muted/30 p-2 space-y-2">
          <input
            type="text"
            value={phoneNotes}
            onChange={(e) => setPhoneNotes(e.target.value)}
            placeholder="Phone reminder notes (optional)"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runPhone(phoneNotes)
              if (e.key === 'Escape') setShowPhoneNotes(false)
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => runPhone(phoneNotes)}
            >
              {pending ? 'Logging…' : 'Log call'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setShowPhoneNotes(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
