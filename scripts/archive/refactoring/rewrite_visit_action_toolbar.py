import sys
import os

def main():
    file_path = 'components/subjects/visits/VisitActionToolbar.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace(
        "import {\n  addVisitRuntimeNoteAction,\n  disablePendingFieldsAction,\n  disableSectionAction,\n  enableFieldsAction,\n  signProcedureAction,\n  validateProcedureAction,\n} from '@/lib/subject/visit-runtime/actions'",
        "import {\n  addVisitRuntimeNoteAction,\n  disablePendingFieldsAction,\n  disableSectionAction,\n  enableFieldsAction,\n  requestProcedureSignatureAction,\n  completeProcedureSignatureAction,\n  validateProcedureAction,\n} from '@/lib/subject/visit-runtime/actions'\nimport { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'"
    )

    # State for signAction
    content = content.replace(
        "  const [signState, signAction, signPending] = useActionState(\n    signProcedureAction,\n    INITIAL_VISIT_RUNTIME_ACTION_STATE,\n  )",
        """  const [signState, signAction, signPending] = useActionState(
    requestProcedureSignatureAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )
  const [completeSignState, completeSignAction, completeSignPending] = useActionState(
    completeProcedureSignatureAction,
    INITIAL_VISIT_RUNTIME_ACTION_STATE,
  )"""
    )

    # UseEffect dependency update
    content = content.replace(
        "      signState.ok ||\n      noteState.ok ||",
        "      signState.ok ||\n      completeSignState.ok ||\n      noteState.ok ||"
    )
    content = content.replace(
        "  }, [disableFieldsState.ok, disableSectionState.ok, enableFieldsState.ok, noteState.ok, router, signState.ok, validationState.message])",
        "  }, [disableFieldsState.ok, disableSectionState.ok, enableFieldsState.ok, noteState.ok, router, signState.ok, completeSignState.ok, validationState.message])"
    )

    # Action messages array update
    content = content.replace(
        "    signState,\n    noteState,",
        "    signState,\n    completeSignState,\n    noteState,"
    )

    # Render of ElectronicSignaturePanel
    old_btn = """        <form action={signAction}>
          <HiddenVisitRuntimeInputs toolbar={toolbar} />
          <Button type="submit" size="sm" disabled={signPending || toolbar.isSigned || toolbar.isLocked || sectionDisabled}>
            {toolbar.isSigned ? 'Signed' : signPending ? 'Signing…' : 'Sign Procedure'}
          </Button>
        </form>"""

    new_btn = """        {!signState.requestId ? (
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
        ) : null}"""

    content = content.replace(old_btn, new_btn)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Success")

if __name__ == "__main__":
    main()
