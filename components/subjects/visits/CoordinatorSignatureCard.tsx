'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
        {canReopen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt('Reopen reason (optional)', '')
              if (reason === null) return
              run(() =>
                reopenCoordinatorProgressNoteAction({
                  visitId: model.visitId,
                  organizationId: model.organizationId,
                  reopenReason: reason,
                }),
              )
            }}
          >
            Reopen progress note
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
