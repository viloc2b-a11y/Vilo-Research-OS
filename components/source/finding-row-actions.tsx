'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INITIAL_FINDING_ACTION_STATE,
  acknowledgeFindingAction,
  resolveFindingAction,
  waiveFindingAction,
} from '@/lib/source/findings/actions'
import type { FindingRowViewModel } from '@/lib/source/read-contract/view-models'

type FindingRowActionsProps = {
  finding: FindingRowViewModel
  organizationId: string
  responseSetId: string
}

function toFeedbackMessage(state: { message: { kind: 'success' | 'error'; title: string; messages: string[]; requestId?: string | null } | null }) {
  if (!state.message) return null
  return {
    kind: state.message.kind,
    title: state.message.title,
    messages: state.message.messages,
    requestId: state.message.requestId,
  }
}

function AcknowledgeForm({
  finding,
  organizationId,
  responseSetId,
}: FindingRowActionsProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    acknowledgeFindingAction,
    INITIAL_FINDING_ACTION_STATE,
  )

  useEffect(() => {
    if (state.message?.kind === 'success') router.refresh()
  }, [state.message, router])

  return (
    <details className="rounded border border-border/60 bg-muted/20">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">Acknowledge</summary>
      <div className="space-y-2 border-t border-border/60 px-2 py-2">
        <CaptureFeedback message={toFeedbackMessage(state)} />
        <form action={action} className="space-y-2">
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="response_set_id" value={responseSetId} />
          <input type="hidden" name="finding_id" value={finding.id} />
          <div className="space-y-1">
            <Label htmlFor={`ack-comment-${finding.id}`} className="text-xs">
              Comment (optional)
            </Label>
            <Input
              id={`ack-comment-${finding.id}`}
              name="text"
              type="text"
              disabled={pending}
              placeholder="Optional acknowledgment note"
              className="h-8 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-7 text-xs">
            {pending ? 'Submitting…' : 'Acknowledge'}
          </Button>
        </form>
      </div>
    </details>
  )
}

function ResolveForm({ finding, organizationId, responseSetId }: FindingRowActionsProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(resolveFindingAction, INITIAL_FINDING_ACTION_STATE)

  useEffect(() => {
    if (state.message?.kind === 'success') router.refresh()
  }, [state.message, router])

  return (
    <details className="rounded border border-border/60 bg-muted/20">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">Resolve</summary>
      <div className="space-y-2 border-t border-border/60 px-2 py-2">
        <CaptureFeedback message={toFeedbackMessage(state)} />
        <form action={action} className="space-y-2">
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="response_set_id" value={responseSetId} />
          <input type="hidden" name="finding_id" value={finding.id} />
          <div className="space-y-1">
            <Label htmlFor={`resolve-text-${finding.id}`} className="text-xs">
              Resolution text
            </Label>
            <Input
              id={`resolve-text-${finding.id}`}
              name="text"
              type="text"
              required
              disabled={pending}
              placeholder="Required resolution comment"
              className="h-8 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-7 text-xs">
            {pending ? 'Submitting…' : 'Resolve'}
          </Button>
        </form>
      </div>
    </details>
  )
}

function WaiveForm({ finding, organizationId, responseSetId }: FindingRowActionsProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(waiveFindingAction, INITIAL_FINDING_ACTION_STATE)

  useEffect(() => {
    if (state.message?.kind === 'success') router.refresh()
  }, [state.message, router])

  return (
    <details className="rounded border border-border/60 bg-muted/20">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">Waive</summary>
      <div className="space-y-2 border-t border-border/60 px-2 py-2">
        <CaptureFeedback message={toFeedbackMessage(state)} />
        <form action={action} className="space-y-2">
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="response_set_id" value={responseSetId} />
          <input type="hidden" name="finding_id" value={finding.id} />
          <div className="space-y-1">
            <Label htmlFor={`waive-reason-${finding.id}`} className="text-xs">
              Waiver reason
            </Label>
            <Input
              id={`waive-reason-${finding.id}`}
              name="text"
              type="text"
              required
              disabled={pending}
              placeholder="Required waiver reason"
              className="h-8 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-7 text-xs">
            {pending ? 'Submitting…' : 'Waive'}
          </Button>
        </form>
      </div>
    </details>
  )
}

export function FindingRowActions({ finding, organizationId, responseSetId }: FindingRowActionsProps) {
  if (!finding.canAcknowledge && !finding.canResolve && !finding.canWaive) {
    return null
  }

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-muted-foreground">Lifecycle actions</p>
      <div className="flex flex-col gap-2">
        {finding.canAcknowledge ? (
          <AcknowledgeForm
            finding={finding}
            organizationId={organizationId}
            responseSetId={responseSetId}
          />
        ) : null}
        {finding.canResolve ? (
          <ResolveForm
            finding={finding}
            organizationId={organizationId}
            responseSetId={responseSetId}
          />
        ) : null}
        {finding.canWaive ? (
          <WaiveForm finding={finding} organizationId={organizationId} responseSetId={responseSetId} />
        ) : null}
      </div>
    </div>
  )
}
