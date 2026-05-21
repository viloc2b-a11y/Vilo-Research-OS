'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureCompletionActions } from '@/components/source/capture-completion-actions'
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

  const saveSuccess =
    saveState.message?.kind === 'success' ? saveState.message : null
  const submitSuccess =
    submitState.message?.kind === 'success' ? submitState.message : null
  const errorFeedback =
    saveState.message?.kind === 'error'
      ? saveState.message
      : submitState.message?.kind === 'error'
        ? submitState.message
        : null
  const infoFeedback =
    !errorFeedback && !saveSuccess && !submitSuccess
      ? saveState.message ?? submitState.message
      : null

  const pending = savePending || submitPending
  const visibleFields = model.fields.filter((field) => field.runtimeState?.visible !== false)

  useEffect(() => {
    if (saveSuccess || submitSuccess) {
      router.refresh()
    }
  }, [saveSuccess, submitSuccess, router])

  const disabled = !model.canEdit || disabledOverride || pending
  const showCompletion =
    (saveSuccess || submitSuccess) && model.completionNav != null

  return (
    <div className="space-y-6">
      {showCompletion ? (
        <CaptureCompletionActions
          message={submitSuccess ?? saveSuccess!}
          actionKind={submitSuccess ? 'submit' : 'save'}
          navigation={model.completionNav}
        />
      ) : (
        <>
          {errorFeedback ? <CaptureFeedback message={errorFeedback} /> : null}
          {infoFeedback ? <CaptureFeedback message={infoFeedback} /> : null}
        </>
      )}

      <form action={saveAction} className="space-y-6">
        <input type="hidden" name="organization_id" value={model.context.organizationId} />
        <input type="hidden" name="response_set_id" value={model.responseSetId} />
        <input
          type="hidden"
          name="procedure_execution_id"
          value={model.context.procedureExecutionId}
        />

        {model.canViewUnblindedSource ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Unblinded Access — Restricted
          </div>
        ) : null}

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
                Submit saves the current form values, then calls the submit API. After success,
                use the actions above to return to the visit or continue.
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
