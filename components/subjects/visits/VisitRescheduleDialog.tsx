'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { rescheduleVisitAction } from '@/lib/visits/actions'
import { validateVisitWindow } from '@/lib/visits/validateVisitWindow'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

type VisitRescheduleDialogProps = {
  row: SubjectVisitGridRow
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function VisitRescheduleDialog({
  row,
  open,
  onClose,
  onSuccess,
}: VisitRescheduleDialogProps) {
  const [scheduledDate, setScheduledDate] = useState(row.scheduledDate ?? row.targetDate ?? '')
  const [overrideReason, setOverrideReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const windowStart = row.windowStart ?? row.targetDate ?? ''
  const windowEnd = row.windowEnd ?? row.targetDate ?? ''

  const preview = useMemo(() => {
    if (!scheduledDate || !windowStart || !windowEnd) return null
    return validateVisitWindow({
      scheduledDate,
      targetDate: row.targetDate,
      windowStartDate: windowStart,
      windowEndDate: windowEnd,
    })
  }, [scheduledDate, row.targetDate, windowStart, windowEnd])

  const needsOverride = preview?.isOutsideWindow ?? false

  if (!open) return null

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await rescheduleVisitAction({
        visitId: row.id,
        organizationId: row.organizationId,
        scheduledDate,
        outOfWindowReason: needsOverride ? overrideReason : null,
      })
      if (!result.ok) {
        setError(result.error ?? 'Could not reschedule visit.')
        return
      }
      onSuccess?.()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-lg"
      >
        <h3 id="reschedule-title" className="text-lg font-semibold">
          Reschedule visit
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.visitName} · protocol window {windowStart} – {windowEnd}
        </p>
        {row.targetDate ? (
          <p className="text-xs text-muted-foreground">Target date: {row.targetDate}</p>
        ) : null}

        <label className="mt-4 block text-sm font-medium">
          Scheduled date
          <input
            type="date"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </label>

        {needsOverride ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">Warning</p>
            <p className="mt-1">
              This visit is being scheduled outside the protocol window. Provide a reason to
              continue — scheduling is not blocked.
            </p>
            <label className="mt-3 block text-xs font-medium">
              Reason for override (required)
              <textarea
                className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </label>
          </div>
        ) : preview ? (
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
            Date is within protocol window.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !scheduledDate}>
            {pending ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </div>
    </div>
  )
}
