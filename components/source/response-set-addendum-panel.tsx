'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INITIAL_ADDENDUM_ACTION_STATE,
  submitResponseSetAddendumAction,
} from '@/lib/source/addendum/actions'
import type { AddendumEligibleFieldViewModel } from '@/lib/source/read-contract/view-models'

type ResponseSetAddendumPanelProps = {
  organizationId: string
  responseSetId: string
  sourceDefinitionVersionId: string | null
  eligibleFields: AddendumEligibleFieldViewModel[]
}

export function ResponseSetAddendumPanel({
  organizationId,
  responseSetId,
  sourceDefinitionVersionId,
  eligibleFields,
}: ResponseSetAddendumPanelProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    submitResponseSetAddendumAction,
    INITIAL_ADDENDUM_ACTION_STATE,
  )

  const defaultFieldId = eligibleFields[0]?.fieldId ?? ''
  const [selectedFieldId, setSelectedFieldId] = useState(defaultFieldId)

  const selectedField = useMemo(
    () => eligibleFields.find((f) => f.fieldId === selectedFieldId) ?? eligibleFields[0],
    [eligibleFields, selectedFieldId],
  )

  useEffect(() => {
    if (state.message?.kind === 'success') {
      router.refresh()
    }
  }, [state.message, router])

  if (eligibleFields.length === 0) {
    return (
      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-3 text-sm text-muted-foreground">
        No fields eligible for late-entry addendum (all fields have a current effective value).
      </div>
    )
  }

  return (
    <details className="rounded-md border border-sky-500/30 bg-sky-500/5 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium text-sky-900 dark:text-sky-100">
        Post-submit addendum (late entry)
      </summary>
      <div className="space-y-3 border-t border-sky-500/20 px-3 py-3">
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
          {sourceDefinitionVersionId ? (
            <input
              type="hidden"
              name="source_definition_version_id"
              value={sourceDefinitionVersionId}
            />
          ) : null}
          <input type="hidden" name="widget_hint" value={selectedField?.widgetHint ?? 'text'} />

          <div className="space-y-2">
            <Label htmlFor="addendum-field">Field (no current value)</Label>
            <select
              id="addendum-field"
              name="source_field_id"
              required
              disabled={pending}
              value={selectedField?.fieldId ?? ''}
              onChange={(e) => setSelectedFieldId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {eligibleFields.map((f) => (
                <option key={f.fieldId} value={f.fieldId}>
                  {f.fieldKey}
                  {f.isRequired ? ' (required)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addendum-value">Addendum value</Label>
            <Input
              id="addendum-value"
              name="addendum_value"
              type="text"
              required
              disabled={pending}
              placeholder="Late-entry value (RPC validates type)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addendum-reason">Late-entry reason / context</Label>
            <Input
              id="addendum-reason"
              name="reason"
              type="text"
              required
              disabled={pending}
              placeholder="Required audit reason"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Calls POST /api/source/response-set/addendum only. Existing submitted responses are not
            mutated; canonical read bundle refreshes after success.
          </p>

          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? 'Submitting addendum…' : 'Submit addendum'}
          </Button>
        </form>
      </div>
    </details>
  )
}
