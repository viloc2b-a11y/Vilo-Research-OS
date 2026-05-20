'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { saveVisitProgressNoteAction } from '@/lib/subject/visits/progress-note/actions'
import type { VisitProgressNoteModel } from '@/lib/subject/visits/progress-note/types'

const PLACEHOLDER =
  'Document visit summary, consent discussion, participant status, relevant findings, protocol issues, and follow-up actions.'

type ProgressNoteEditorProps = {
  model: VisitProgressNoteModel
  readOnly: boolean
  locked?: boolean
}

export function ProgressNoteEditor({ model, readOnly, locked }: ProgressNoteEditorProps) {
  const [text, setText] = useState(model.noteText)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await saveVisitProgressNoteAction({
        visitId: model.visitId,
        organizationId: model.organizationId,
        noteText: text,
      })
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setMessage('Progress note saved.')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="coordinator-progress-note" className="text-sm font-medium">
          Coordinator progress note
        </label>
        {locked ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Locked
          </span>
        ) : null}
      </div>
      <textarea
        id="coordinator-progress-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
        rows={8}
        placeholder={PLACEHOLDER}
        className={cn(
          'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed',
          locked
            ? 'border-amber-300/80 bg-muted/40 opacity-90 dark:border-amber-800'
            : 'border-input',
          readOnly && !locked && 'opacity-60',
        )}
      />
      {readOnly ? (
        <p className="text-xs text-muted-foreground">
          {locked
            ? 'Progress note is locked after coordinator signature. Reopen to edit.'
            : 'Editing disabled for this closeout state.'}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={save}>
            {pending ? 'Saving…' : 'Save progress note'}
          </Button>
          {message ? (
            <p
              className={
                message.includes('saved')
                  ? 'text-xs text-emerald-700 dark:text-emerald-300'
                  : 'text-xs text-destructive'
              }
            >
              {message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
