'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitFieldCorrectionAction } from '@/lib/source/correction/actions'
import { INITIAL_CORRECTION_ACTION_STATE } from '@/lib/source/correction/action-state'
import type { FieldRowViewModel } from '@/lib/source/read-contract/view-models'

type FieldCorrectionPanelProps = {
  field: FieldRowViewModel
  organizationId: string
  responseSetId: string
}

export function FieldCorrectionPanel({
  field,
  organizationId,
  responseSetId,
}: FieldCorrectionPanelProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    submitFieldCorrectionAction,
    INITIAL_CORRECTION_ACTION_STATE,
  )

  useEffect(() => {
    if (state.message?.kind === 'success') {
      router.refresh()
    }
  }, [state.message, router])

  if (!field.currentResponseId) return null

  return (
    <details className="rounded-md border border-amber-500/30 bg-amber-500/5 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium text-amber-900 dark:text-amber-100">
        Post-submit correction
      </summary>
      <div className="space-y-3 border-t border-amber-500/20 px-3 py-3">
        <CaptureFeedback
          message={
            state.message
              ? {
                  kind: state.message.kind,
                  title: state.message.title,
                  messages: state.message.messages,
                  requestId: state.message.requestId,
                }
              : null
          }
        />

        <form action={action} className="space-y-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="response_set_id" value={responseSetId} />
          <input type="hidden" name="source_response_id" value={field.currentResponseId} />
          <input type="hidden" name="widget_hint" value={field.widgetHint} />

          <div>
            <Label className="text-xs text-muted-foreground">Current effective value</Label>
            <p className="mt-1 font-mono text-sm">{field.displayValue}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Response {field.currentResponseId.slice(0, 8)}…
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`corrected-${field.fieldId}`}>Corrected value</Label>
            <Input
              id={`corrected-${field.fieldId}`}
              name="corrected_value"
              type="text"
              required
              disabled={pending}
              placeholder="New value (RPC validates type)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reason-${field.fieldId}`}>Correction reason</Label>
            <Input
              id={`reason-${field.fieldId}`}
              name="correction_reason"
              type="text"
              required
              disabled={pending}
              placeholder="Required audit reason"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Calls POST /api/source/response/correct only. Prior versions remain in history; no
            optimistic UI updates.
          </p>

          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? 'Submitting correction…' : 'Submit correction'}
          </Button>
        </form>
      </div>
    </details>
  )
}
