'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
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

// F-05 fix: inline note form replaces window.prompt() for coordinator note
function InlineNoteForm({
  initialValue,
  onSubmit,
  onCancel,
  pending,
}: {
  initialValue: string
  onSubmit: (note: string) => void
  onCancel: () => void
  pending: boolean
}) {
  const [note, setNote] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="px-3 py-2 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Coordinator note</p>
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Add a coordinator note (optional)"
        className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoFocus
        disabled={pending}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => onSubmit(note)}
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function VisitActionsMenu({ row }: VisitActionsMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [noteFormOpen, setNoteFormOpen] = useState(false)
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

  const handleSaveNote = (note: string) => {
    setNoteFormOpen(false)
    run(() =>
      addVisitNoteAction({
        visitId: row.id,
        organizationId: row.organizationId,
        note,
      }),
    )
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
            onClick={() => {
              setOpen(false)
              setNoteFormOpen(false)
            }}
          />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border bg-popover py-1 shadow-md">
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
              onClick={(e) => {
                e.stopPropagation()
                setNoteFormOpen((v) => !v)
              }}
            >
              {noteFormOpen ? 'Cancel note' : 'Add note'}
            </button>

            {/* F-05: inline form instead of window.prompt */}
            {noteFormOpen ? (
              <InlineNoteForm
                initialValue={row.coordinatorNote ?? ''}
                onSubmit={handleSaveNote}
                onCancel={() => setNoteFormOpen(false)}
                pending={pending}
              />
            ) : null}
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
