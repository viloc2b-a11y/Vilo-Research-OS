'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  INVESTIGATOR_ROLE_OPTIONS,
  investigatorRoleLabel,
} from '@/lib/subject/visits/progress-note/types'
import {
  reopenInvestigatorReviewAction,
  requestInvestigatorCloseoutSignatureAction,
  completeInvestigatorCloseoutSignatureAction
} from '@/lib/subject/visits/progress-note/actions'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'
import type { VisitCloseoutGuards } from '@/lib/subject/visits/progress-note/guards'
import type {
  InvestigatorRole,
  VisitProgressNoteModel,
} from '@/lib/subject/visits/progress-note/types'

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

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-900">
        Reopen reason <span className="text-red-600">*</span>
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Document reason for reopening the investigator review (required for audit trail)"
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

type InvestigatorSignatureCardProps = {
  model: VisitProgressNoteModel
  guards: VisitCloseoutGuards
  disabled?: boolean
  /**
   * F-07: pass whether the current viewer has investigator signing rights.
   * Derived server-side (canSignClinicalSource) and forwarded as a prop so the
   * UI accurately reflects access without a client-side membership call.
   */
  canSign?: boolean
}

export function InvestigatorSignatureCard({
  model,
  guards,
  disabled,
  canSign: userCanSign = false,
}: InvestigatorSignatureCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [role, setRole] = useState<InvestigatorRole>(
    model.investigatorRole ?? 'principal_investigator',
  )
  const [showReopenForm, setShowReopenForm] = useState(false)
  const [signatureRequestId, setSignatureRequestId] = useState<string | null>(null)

  const coordinatorReady =
    model.visitReviewStatus === 'coordinator_signed'
    || model.visitReviewStatus === 'investigator_signed'

  // F-07 fix: client-side guard uses userCanSign prop (set by server render)
  const canSignNow =
    !disabled
    && userCanSign
    && coordinatorReady
    && model.investigatorReviewStatus !== 'signed'
    && model.coordinatorSignatureStatus === 'signed'
    && !guards.investigatorSignBlocked

  const canReopen = !disabled && model.visitReviewStatus === 'investigator_signed'

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; visitAutoCompleted?: boolean; requestId?: string }>,
    isRequest = false
  ) => {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage(result.error ?? 'Action failed')
        return
      }
      if (isRequest && result.requestId) {
        setSignatureRequestId(result.requestId)
      } else {
        setSignatureRequestId(null)
        if (result.visitAutoCompleted) {
          setMessage('Investigator signed. Visit marked completed.')
        } else {
          setMessage(
            'Investigator signed. Visit stays in progress until procedures and findings are resolved.',
          )
        }
        router.refresh()
      }
    })
  }

  const handleReopen = (reason: string) => {
    setShowReopenForm(false)
    run(() =>
      reopenInvestigatorReviewAction({
        visitId: model.visitId,
        organizationId: model.organizationId,
        reopenReason: reason,
        expectedUpdatedAt: model.updatedAt,
      }),
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Investigator review &amp; signature</p>
        <p className="text-xs text-muted-foreground">
          PI or Sub-I operational review after coordinator closeout. Part 11 compliant electronic signature.
        </p>
      </div>

      {guards.investigatorBlockReasons.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
          {guards.investigatorBlockReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {/* F-07: surface role restriction to non-qualifying users */}
      {coordinatorReady && !userCanSign ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Investigator sign-off requires the <strong>PI / Sub-I</strong>, admin, or owner role.
          Your current role does not include investigator signing authority.
        </p>
      ) : null}

      {!coordinatorReady ? (
        <p className="text-sm text-muted-foreground">
          Available after the coordinator signs the progress note.
        </p>
      ) : (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Review status</dt>
              <dd className="font-medium capitalize">
                {model.investigatorReviewStatus.replace(/_/g, ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Role</dt>
              <dd>{investigatorRoleLabel(model.investigatorRole)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Signed by</dt>
              <dd>{model.investigatorSignedByName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Signed at</dt>
              <dd>{formatWhen(model.investigatorSignedAt) ?? '—'}</dd>
            </div>
          </dl>

          {canSignNow && !signatureRequestId ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="investigator-role"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Signing role
                </label>
                <select
                  id="investigator-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvestigatorRole)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {INVESTIGATOR_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    requestInvestigatorCloseoutSignatureAction({
                      visitId: model.visitId,
                      organizationId: model.organizationId,
                      investigatorRole: role,
                      expectedUpdatedAt: model.updatedAt,
                    }),
                    true
                  )
                }
              >
                Request Signature
              </Button>
            </div>
          ) : null}

          {signatureRequestId ? (
            <div className="w-full mt-4">
              <ElectronicSignaturePanel
                requestId={signatureRequestId}
                requiredRole={role}
                signatureMeaning="I attest that I have reviewed the visit and all procedures."
                attestationText="I verify that I have reviewed the progress note, procedures, and findings."
                status="pending"
                onSigned={() => {
                  run(() => completeInvestigatorCloseoutSignatureAction({
                    visitId: model.visitId,
                    organizationId: model.organizationId,
                    investigatorRole: role
                  }))
                }}
              />
            </div>
          ) : null}

          {/* F-05 fix: replaced window.prompt with inline form */}
          <div className="flex flex-wrap gap-2">
            {canReopen && !showReopenForm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setShowReopenForm(true)}
              >
                Reopen review
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
        </>
      )}

      {message ? (
        <p
          className={
            message.includes('completed')
              ? 'text-xs text-emerald-700 dark:text-emerald-300'
              : 'text-xs text-destructive'
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
