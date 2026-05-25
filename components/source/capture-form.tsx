'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureCompletionActions } from '@/components/source/capture-completion-actions'
import { CaptureField } from '@/components/source/capture-field'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveCaptureDraftAction, submitCaptureAction } from '@/lib/source/capture/actions'
import {
  INITIAL_CAPTURE_ACTION_STATE,
  type CaptureShellViewModel,
} from '@/lib/source/capture/types'

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

  const fieldsLocked = !model.canEdit || disabledOverride
  const controlsDisabled = fieldsLocked || pending
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
          name="response_set_updated_at"
          value={model.responseSetUpdatedAt}
        />
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
                disabled={
                  fieldsLocked
                  || (field.runtimeState?.disabled === true && !field.isRequired)
                }
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
                disabled={fieldsLocked}
              />
              <p className="text-xs text-muted-foreground">
                Submit saves the current form values, then calls the submit API. After success,
                use the actions above to return to the visit or continue.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={buttonVariants({ variant: 'secondary' })}
                disabled={controlsDisabled}
              >
                {savePending ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="submit"
                formAction={submitAction}
                className={buttonVariants()}
                disabled={controlsDisabled}
              >
                {submitPending ? 'Submitting…' : 'Save and submit'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              This source has already been submitted.
            </p>
            <p className="mt-1">
              Use correction/addendum workflow if changes are needed. You can still{' '}
              <a href={model.reviewHref} className="font-medium underline">
                open source review
              </a>{' '}
              to inspect lineage
              {disabledOverride ? ' (operationally disabled for your role)' : model.statusLabel ? ` (${model.statusLabel})` : ''}.
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
