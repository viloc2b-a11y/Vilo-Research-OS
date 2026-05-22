'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  reopenCoordinatorProgressNoteAction,
  signCoordinatorProgressNoteAction,
} from '@/lib/subject/visits/progress-note/actions'
import type { VisitCloseoutGuards } from '@/lib/subject/visits/progress-note/guards'
import type { VisitProgressNoteModel } from '@/lib/subject/visits/progress-note/types'

function formatWhen(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// F-05 fix: inline reason form replaces window.prompt()
function ReopenReasonForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (reason: string) => void
  onCancel: () => void
  pending: boolean
}) {
  const [reason, setReason] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-900">
        Reopen reason <span className="text-red-600">*</span>
      </p>
      <textarea
        ref={inputRef}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Document reason for reopening (required for audit trail)"
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoFocus
        disabled={pending}
      />
      <p className="text-[10px] text-amber-700">
        This reason will be recorded in the visit audit trail.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || reason.trim().length < 3}
          onClick={() => onSubmit(reason.trim())}
        >
          {pending ? 'Reopening…' : 'Confirm reopen'}
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

type CoordinatorSignatureCardProps = {
  model: VisitProgressNoteModel
  guards: VisitCloseoutGuards
  disabled?: boolean
}

export function CoordinatorSignatureCard({
  model,
  guards,
  disabled,
}: CoordinatorSignatureCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [showReopenForm, setShowReopenForm] = useState(false)

  const isSigned = model.coordinatorSignatureStatus === 'signed'
  const canSign =
    !disabled
    && !isSigned
    && (model.visitReviewStatus === 'draft' || model.visitReviewStatus === 'reopened')
    && !guards.coordinatorSignBlocked
  const canReopen =
    !disabled
    && isSigned
    && (model.visitReviewStatus === 'coordinator_signed'
      || model.visitReviewStatus === 'investigator_signed'
      || model.visitReviewStatus === 'reopened')

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage(result.error ?? 'Action failed')
        return
      }
      router.refresh()
    })
  }

  const handleReopen = (reason: string) => {
    setShowReopenForm(false)
    run(() =>
      reopenCoordinatorProgressNoteAction({
        visitId: model.visitId,
        organizationId: model.organizationId,
        reopenReason: reason,
      }),
    )
  }

  return (
    <div className="mt-6 space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Coordinator signature</p>
        <p className="text-xs text-muted-foreground">
          Operational attestation only — not a Part 11 electronic signature.
        </p>
      </div>

      {guards.coordinatorBlockReasons.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
          {guards.coordinatorBlockReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{model.coordinatorSignatureStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Signed by</dt>
          <dd>{model.coordinatorSignedByName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Signed at</dt>
          <dd>{formatWhen(model.coordinatorSignedAt) ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {canSign ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                signCoordinatorProgressNoteAction({
                  visitId: model.visitId,
                  organizationId: model.organizationId,
                }),
              )
            }
          >
            Sign progress note
          </Button>
        ) : null}

        {/* F-05 fix: replaced window.prompt with inline form */}
        {canReopen && !showReopenForm ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setShowReopenForm(true)}
          >
            Reopen progress note
          </Button>
        ) : null}
      </div>

      {showReopenForm ? (
        <ReopenReasonForm
          onSubmit={handleReopen}
          onCancel={() => setShowReopenForm(false)}
          pending={pending}
        />
      ) : null}

      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
