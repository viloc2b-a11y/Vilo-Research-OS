'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  addVisitRuntimeNoteAction,
  disablePendingFieldsAction,
  disableSectionAction,
  enableFieldsAction,
  signProcedureAction,
  validateProcedureAction,
} from '@/lib/subject/visit-runtime/actions'
import {
  INITIAL_VISIT_RUNTIME_ACTION_STATE,
  type VisitRuntimeToolbarModel,
} from '@/lib/subject/visit-runtime/types'

type VisitActionToolbarProps = {
  toolbar: VisitRuntimeToolbarModel
  fieldsDisabled: boolean
  sectionDisabled: boolean
}

function StatusPill({ value }: { value: string }) {
  return <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{value}</span>
}

export function VisitActionToolbar({
  toolbar,
  fieldsDisabled,
  sectionDisabled,
}: VisitActionToolbarProps) {
  const router = useRouter()
  const [panel, setPanel] = useState<'note' | 'audit' | 'alerts' | null>(null)
  const [signState, signAction, signPending] = useActionState(
    signProcedureAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [noteState, noteAction, notePending] = useActionState(
    addVisitRuntimeNoteAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [validationState, validationAction, validationPending] = useActionState(
    validateProcedureAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [disableFieldsState, disableFieldsAction, disableFieldsPending] = useActionState(
    disablePendingFieldsAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [enableFieldsState, enableFieldsActionState, enableFieldsPending] = useActionState(
    enableFieldsAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [disableSectionState, disableSectionActionState, disableSectionPending] = useActionState(
    disableSectionAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )

  useEffect(() => {
    if (
      signState.ok ||
      noteState.ok ||
      validationState.message ||
      disableFieldsState.ok ||
      enableFieldsState.ok ||
      disableSectionState.ok
    ) {
      router.refresh()
    }
  }, [disableFieldsState.ok, disableSectionState.ok, enableFieldsState.ok, noteState.ok, router, signState.ok, validationState.message])

  const HiddenInputs = () => (
    <>
      <input type="hidden" name="procedure_execution_id" value={toolbar.procedureExecutionId} />
      <input type="hidden" name="organization_id" value={toolbar.organizationId} />
      <input type="hidden" name="response_set_id" value={toolbar.responseSetId} />
    </>
  )
  const actionMessages = [
    signState,
    noteState,
    validationState,
    disableFieldsState,
    enableFieldsState,
    disableSectionState,
  ].filter((state) => state.message)

  return (
    <div className="sticky top-0 z-30 space-y-2 border-b bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-2">
        <form action={signAction}>
          <HiddenInputs />
          <Button type="submit" size="sm" disabled={signPending || toolbar.isSigned || toolbar.isLocked || sectionDisabled}>
            {toolbar.isSigned ? 'Signed' : signPending ? 'Signing…' : 'Sign Procedure'}
          </Button>
        </form>

        <a
          href={toolbar.pdfHref}
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          Download Procedure PDF
        </a>

        <Button type="button" size="sm" variant="outline" onClick={() => setPanel(panel === 'note' ? null : 'note')}>
          Add Note
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setPanel(panel === 'audit' ? null : 'audit')}>
          Audit Trail
        </Button>
        <form action={validationAction}>
          <HiddenInputs />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={validationPending}
            onClick={() => setPanel('alerts')}
          >
            {validationPending ? 'Scanning…' : 'Validation Alerts'}
          </Button>
        </form>
        <form action={disableFieldsAction}>
          <HiddenInputs />
          <input type="hidden" name="disable_reason" value="Coordinator disabled pending fields from visit runtime toolbar." />
          <Button type="submit" size="sm" variant="secondary" disabled={disableFieldsPending || fieldsDisabled || toolbar.isLocked}>
            Disable All Pending Fields
          </Button>
        </form>
        <form action={enableFieldsActionState}>
          <HiddenInputs />
          <Button type="submit" size="sm" variant="secondary" disabled={enableFieldsPending || !fieldsDisabled || toolbar.isLocked}>
            Enable Fields
          </Button>
        </form>
        <form action={disableSectionActionState}>
          <HiddenInputs />
          <input type="hidden" name="disable_reason" value="Coordinator disabled procedure section from visit runtime toolbar." />
          <Button type="submit" size="sm" variant="secondary" disabled={disableSectionPending || sectionDisabled || toolbar.isLocked}>
            Disable Section
          </Button>
        </form>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusPill value={toolbar.validationStatus} />
          {toolbar.isLocked ? <StatusPill value="locked" /> : null}
          {fieldsDisabled ? <StatusPill value="fields disabled" /> : null}
          {sectionDisabled ? <StatusPill value="section disabled" /> : null}
        </div>
      </div>

      {actionMessages.length ? (
        <div className="space-y-1">
          {actionMessages.map((state, index) => (
            <p
              key={`${state.message}-${index}`}
              className={
                state.ok
                  ? 'text-sm text-emerald-700'
                  : 'whitespace-pre-wrap text-sm text-destructive'
              }
            >
              {state.message}
            </p>
          ))}
        </div>
      ) : null}

      {panel === 'note' ? (
        <form action={noteAction} className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[1fr_auto]">
          <HiddenInputs />
          <textarea
            name="note_text"
            className="min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Add an operational note for this visit/procedure"
          />
          <Button type="submit" disabled={notePending}>
            {notePending ? 'Adding…' : 'Add Note'}
          </Button>
          {toolbar.notes.length ? (
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Note history</p>
              <ul className="space-y-1 text-xs">
                {toolbar.notes.map((note) => (
                  <li key={note.id} className="rounded border bg-background px-2 py-1">
                    <span className="font-medium">{note.createdAt}</span>
                    {note.createdBy ? <span className="text-muted-foreground"> · {note.createdBy.slice(0, 8)}</span> : null}
                    <p className="mt-1 text-sm">{note.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      ) : null}

      {panel === 'audit' ? (
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="mb-2 text-sm font-medium">Audit Trail</p>
          <ul className="divide-y rounded-md border bg-background text-sm">
            {toolbar.auditEntries.map((entry) => (
              <li key={entry.id} className="grid gap-1 px-3 py-2 md:grid-cols-[1fr_auto]">
                <div>
                  <span className="font-medium">{entry.fieldLabel}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{entry.eventType}</span>
                  {entry.isCorrection ? <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-800">correction</span> : null}
                  {entry.isAddendum ? <span className="ml-2 rounded bg-blue-100 px-1 text-xs text-blue-800">addendum</span> : null}
                  <p className="text-xs text-muted-foreground">
                    {entry.previousValue ?? '-'} → {entry.newValue ?? '-'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {entry.changedAt}{entry.changedBy ? ` · ${entry.changedBy.slice(0, 8)}` : ''}
                </span>
              </li>
            ))}
            {!toolbar.auditEntries.length ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No audit events recorded yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {panel === 'alerts' ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="font-medium">Validation Alerts</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>{toolbar.missingRequiredCount} missing required field(s)</li>
            <li>{toolbar.unresolvedFindingCount} unresolved validation finding(s)</li>
            <li>{toolbar.unsignedSectionCount} unsigned section(s)</li>
          </ul>
          {toolbar.validationAlerts.length ? (
            <ul className="mt-3 divide-y rounded-md border bg-background">
              {toolbar.validationAlerts.map((alert) => (
                <li key={alert.id} className="px-3 py-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{alert.severity}</span>
                  <span className="ml-2">{alert.fieldLabel ? `${alert.fieldLabel}: ` : ''}{alert.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted-foreground">No active validation alerts.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
