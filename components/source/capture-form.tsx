'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureField } from '@/components/source/capture-field'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INITIAL_CAPTURE_ACTION_STATE,
  saveCaptureDraftAction,
  submitCaptureAction,
} from '@/lib/source/capture/actions'
import type { CaptureShellViewModel } from '@/lib/source/capture/types'

type CaptureFormProps = {
  model: CaptureShellViewModel
  disabledOverride?: boolean
}

export function CaptureForm({ model, disabledOverride = false }: CaptureFormProps) {
  const router = useRouter()
  const [saveState, saveAction, savePending] = useActionState(
    saveCaptureDraftAction,
    INITIAL_CAPTURE_ACTION_STATE,
  )
  const [submitState, submitAction, submitPending] = useActionState(
    submitCaptureAction,
    INITIAL_CAPTURE_ACTION_STATE,
  )

  const feedback = submitState.message ?? saveState.message
  const pending = savePending || submitPending
  const visibleFields = model.fields.filter((field) => field.runtimeState?.visible !== false)

  useEffect(() => {
    if (feedback?.kind === 'success') {
      router.refresh()
    }
  }, [feedback, router])

  const disabled = !model.canEdit || disabledOverride || pending

  return (
    <div className="space-y-6">
      <CaptureFeedback message={feedback} />

      <form action={saveAction} className="space-y-6">
        <input type="hidden" name="organization_id" value={model.context.organizationId} />
        <input type="hidden" name="response_set_id" value={model.responseSetId} />
        <input
          type="hidden"
          name="procedure_execution_id"
          value={model.context.procedureExecutionId}
        />
        <input type="hidden" name="fields_json" value={JSON.stringify(model.fields)} />

        <ul className="divide-y divide-border rounded-md border">
          {visibleFields.map((field) => (
            <li key={field.fieldId} className="px-3 py-4">
              <CaptureField
                field={field}
                disabled={disabled || field.runtimeState?.disabled === true}
              />
            </li>
          ))}
        </ul>

        {model.canEdit && !disabledOverride ? (
          <div className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div className="space-y-2">
              <Label htmlFor="submit_reason">Submit reason</Label>
              <Input
                id="submit_reason"
                name="submit_reason"
                type="text"
                placeholder="Required to submit (e.g. visit complete)"
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Submit saves the current form values, then calls the submit API. No optimistic
                updates — the page reloads from the server after success.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" disabled={disabled}>
                {savePending ? 'Saving…' : 'Save draft'}
              </Button>
              <Button type="submit" formAction={submitAction} disabled={disabled}>
                {submitPending ? 'Submitting…' : 'Save and submit'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This response set is read-only ({disabledOverride ? 'operationally disabled' : model.statusLabel}). Use{' '}
            <a href={model.reviewHref} className="font-medium underline">
              source review
            </a>{' '}
            to inspect lineage.
          </p>
        )}
      </form>
    </div>
  )
}
