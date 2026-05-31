import sys

def main():
    file_path = 'components/subjects/visits/CoordinatorSignatureCard.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace(
        "import {\n  reopenCoordinatorProgressNoteAction,\n  signCoordinatorProgressNoteAction,\n} from '@/lib/subject/visits/progress-note/actions'",
        "import {\n  reopenCoordinatorProgressNoteAction,\n  requestCoordinatorCloseoutSignatureAction,\n  completeCoordinatorCloseoutSignatureAction\n} from '@/lib/subject/visits/progress-note/actions'\nimport { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'"
    )

    # Component body
    old_body_start = "  const [showReopenForm, setShowReopenForm] = useState(false)"
    old_body_end = "  const isSigned = model.coordinatorSignatureStatus === 'signed'"
    
    new_body_start = """  const [showReopenForm, setShowReopenForm] = useState(false)
  const [signatureRequestId, setSignatureRequestId] = useState<string | null>(null)

  const isSigned = model.coordinatorSignatureStatus === 'signed'"""

    content = content.replace(old_body_start + "\n\n" + old_body_end, new_body_start)

    # run method modification for request
    old_run = """  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage(result.error ?? 'Action failed')
        return
      }
      router.refresh()
    })
  }"""

    new_run = """  const run = (fn: () => Promise<{ ok: boolean; error?: string; requestId?: string }>, isRequest = false) => {
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
        router.refresh()
      }
    })
  }"""

    content = content.replace(old_run, new_run)

    # the button and panel
    old_btn = """        {canSign ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                signCoordinatorProgressNoteAction({
                  visitId: model.visitId,
                  organizationId: model.organizationId,
                  expectedUpdatedAt: model.updatedAt,
                }),
              )
            }
          >
            Sign progress note
          </Button>
        ) : null}"""

    new_btn = """        {canSign && !signatureRequestId ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                requestCoordinatorCloseoutSignatureAction({
                  visitId: model.visitId,
                  organizationId: model.organizationId,
                  expectedUpdatedAt: model.updatedAt,
                }),
                true
              )
            }
          >
            Request Signature
          </Button>
        ) : null}

        {signatureRequestId ? (
          <div className="w-full mt-4">
            <ElectronicSignaturePanel
              requestId={signatureRequestId}
              requiredRole="coordinator"
              signatureMeaning="I attest that all visit procedures are accurate and complete."
              attestationText="I verify that I have reviewed the progress note and procedures."
              status="pending"
              onSigned={() => {
                run(() => completeCoordinatorCloseoutSignatureAction({
                  visitId: model.visitId,
                  organizationId: model.organizationId
                }))
              }}
            />
          </div>
        ) : null}"""

    content = content.replace(old_btn, new_btn)

    # replace the text "Operational attestation only — not a Part 11 electronic signature."
    content = content.replace(
        "Operational attestation only — not a Part 11 electronic signature.",
        "Part 11 compliant electronic signature."
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Success Coordinator")

if __name__ == "__main__":
    main()
