'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { VisitRescheduleDialog } from '@/components/subjects/visits/VisitRescheduleDialog'
import { VisitReminderActions } from '@/components/subjects/visits/VisitReminderActions'
import {
  addVisitNoteAction,
  markVisitCompleteAction,
} from '@/lib/subject/visits/actions'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

type VisitActionsMenuProps = {
  row: SubjectVisitGridRow
}

export function VisitActionsMenu({ row }: VisitActionsMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const orgQs = `?organization_id=${row.organizationId}`
  const sourceHref = row.primaryProcedureId
    ? `/source/capture/${row.primaryProcedureId}${orgQs}`
    : `/visits/${row.id}`

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage(result.error ?? 'Action failed')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Actions
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border bg-popover py-1 shadow-md">
            <Link
              href={`/visits/${row.id}`}
              className="block px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Open visit
            </Link>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setOpen(false)
                setRescheduleOpen(true)
              }}
            >
              Reschedule
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              disabled={row.visitStatus === 'completed' || row.visitStatus === 'cancelled'}
              onClick={() =>
                run(() =>
                  markVisitCompleteAction({
                    visitId: row.id,
                    organizationId: row.organizationId,
                  }),
                )
              }
            >
              Mark complete
            </button>
            <Link
              href={sourceHref}
              className="block px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              View source
            </Link>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                const note = window.prompt('Coordinator note', row.coordinatorNote ?? '')
                if (note === null) return
                run(() =>
                  addVisitNoteAction({
                    visitId: row.id,
                    organizationId: row.organizationId,
                    note,
                  }),
                )
              }}
            >
              Add note
            </button>
          </div>
        </>
      ) : null}
      <VisitRescheduleDialog
        row={row}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onSuccess={() => router.refresh()}
      />
      {message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null}
    </div>
  )
}

export function VisitRowReminderStrip({ row }: { row: SubjectVisitGridRow }) {
  return (
    <div className="mt-2 border-t pt-2">
      <VisitReminderActions visitId={row.id} organizationId={row.organizationId} />
    </div>
  )
}
