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

  const run = (reminderType: 'sms' | 'phone') => {
    setMessage(null)
    const notes =
      reminderType === 'phone'
        ? window.prompt('Phone reminder notes (optional)', '') ?? undefined
        : undefined
    startTransition(async () => {
      const result = await sendVisitReminderAction({
        visitId,
        organizationId,
        reminderType,
        notes,
      })
      setMessage(result.ok ? 'Reminder logged.' : (result.error ?? 'Failed'))
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run('sms')}
      >
        Log SMS reminder
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run('phone')}
      >
        Log phone reminder
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  )
}
