'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  addVisitRuntimeNoteAction,
  disablePendingFieldsAction,
  disableSectionAction,
  setApplicabilityAction,
  enableFieldsAction,
  requestProcedureSignatureAction,
  completeProcedureSignatureAction,
  validateProcedureAction,
} from '@/lib/subject/visit-runtime/actions'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'
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

function HiddenVisitRuntimeInputs({ toolbar }: { toolbar: VisitRuntimeToolbarModel }) {
  return (
    <>
      <input type="hidden" name="procedure_execution_id" value={toolbar.procedureExecutionId} />
      <input type="hidden" name="organization_id" value={toolbar.organizationId} />
      <input type="hidden" name="response_set_id" value={toolbar.responseSetId} />
      {toolbar.updatedAt ? <input type="hidden" name="expected_updated_at" value={toolbar.updatedAt} /> : null}
    </>
  )
}

export function VisitActionToolbar({
  toolbar,
  fieldsDisabled,
  sectionDisabled,
}: VisitActionToolbarProps) {
  const router = useRouter()
  const [panel, setPanel] = useState<'note' | 'audit' | 'alerts' | 'applicability' | null>(null)
  const [signState, signAction, signPending] = useActionState(
    requestProcedureSignatureAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [completeSignState, completeSignAction, completeSignPending] = useActionState(
    completeProcedureSignatureAction,
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
  const [applicabilityState, applicabilityAction, applicabilityPending] = useActionState(
    setApplicabilityAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )

  useEffect(() => {
    if (
      signState.ok ||
      completeSignState.ok ||
      noteState.ok ||
      validationState.message ||
      disableFieldsState.ok ||
      enableFieldsState.ok ||
      disableSectionState.ok ||
      applicabilityState.ok
    ) {
      router.refresh()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (applicabilityState.ok) setPanel(null)
    }
  }, [disableFieldsState.ok, disableSectionState.ok, enableFieldsState.ok, noteState.ok, router, signState.ok, completeSignState.ok, validationState.message, applicabilityState.ok])

  const actionMessages = [
    signState,
    completeSignState,
    noteState,
    validationState,
    disableFieldsState,
    enableFieldsState,
    disableSectionState,
    applicabilityState,
  ].filter((state) => state.message)

  return (
    <div className="sticky top-0 z-30 space-y-2 border-b bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-2">
        {!signState.requestId ? (
          <form action={signAction}>
            <HiddenVisitRuntimeInputs toolbar={toolbar} />
            <Button type="submit" size="sm" disabled={signPending || toolbar.isSigned || toolbar.isLocked || sectionDisabled}>
              {toolbar.isSigned ? 'Signed' : signPending ? 'Requesting…' : 'Sign Procedure'}
            </Button>
          </form>
        ) : null}

        {signState.requestId ? (
          <div className="w-full mt-2">
            <ElectronicSignaturePanel
              requestId={signState.requestId}
              requiredRole="coordinator"
              signatureMeaning="I attest that the procedure data is accurate and complete."
              attestationText="I verify that I have reviewed the procedure execution."
              status="pending"
              onSigned={() => {
                const formData = new FormData()
                formData.set('procedure_execution_id', toolbar.procedureExecutionId)
                formData.set('organization_id', toolbar.organizationId)
                if (toolbar.responseSetId) formData.set('response_set_id', toolbar.responseSetId)
                if (signState.validation) formData.set('validation', JSON.stringify(signState.validation))
                completeSignAction(formData)
              }}
            />
          </div>
        ) : null}

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
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
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
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
          <input type="hidden" name="disable_reason" value="Coordinator disabled pending fields from visit runtime toolbar." />
          <Button type="submit" size="sm" variant="secondary" disabled={disableFieldsPending || fieldsDisabled || toolbar.isLocked}>
            Disable All Pending Fields
          </Button>
        </form>
        <form action={enableFieldsActionState}>
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
          <Button type="submit" size="sm" variant="secondary" disabled={enableFieldsPending || !fieldsDisabled || toolbar.isLocked}>
            Enable Fields
          </Button>
        </form>
        <Button 
          type="button" 
          size="sm" 
          variant="secondary" 
          disabled={sectionDisabled || toolbar.isLocked} 
          onClick={() => setPanel(panel === 'applicability' ? null : 'applicability')}
        >
          Mark Applicability
        </Button>

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
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
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

      {panel === 'applicability' ? (
        <form action={applicabilityAction} className="rounded-md border bg-muted/20 p-4 space-y-4">
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
          <div>
            <p className="font-medium mb-2">Mark Procedure Applicability</p>
            <p className="text-sm text-muted-foreground mb-4">
              Select an applicability status to omit this procedure from missing data validation. This will be recorded in the audit trail and must be signed.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select name="applicability_status" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                  <option value="">Select status...</option>
                  <option value="not_applicable">Not Applicable</option>
                  <option value="skipped">Skipped (Intentional)</option>
                  <option value="missed">Missed (Unintentional)</option>
                  <option value="contraindicated">Medically Contraindicated</option>
                  <option value="protocol_exception">Protocol Exception</option>
                  <option value="medical_exception">Medical Exception</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason (Required)</label>
                <input type="text" name="applicability_reason" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Provide clinical justification" required />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
              <Button type="submit" disabled={applicabilityPending}>{applicabilityPending ? 'Saving...' : 'Save Applicability'}</Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  )
}
