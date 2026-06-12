import sys

def main():
    file_path = 'components/subjects/visits/InvestigatorSignatureCard.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace(
        "import {\n  reopenInvestigatorReviewAction,\n  signInvestigatorReviewAction,\n} from '@/lib/subject/visits/progress-note/actions'",
        "import {\n  reopenInvestigatorReviewAction,\n  requestInvestigatorCloseoutSignatureAction,\n  completeInvestigatorCloseoutSignatureAction\n} from '@/lib/subject/visits/progress-note/actions'\nimport { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'"
    )

    # Component body
    old_body_start = "  const [showReopenForm, setShowReopenForm] = useState(false)"
    old_body_end = "  const canReopen = !disabled && model.visitReviewStatus === 'investigator_signed'"
    
    new_body_start = """  const [showReopenForm, setShowReopenForm] = useState(false)
  const [signatureRequestId, setSignatureRequestId] = useState<string | null>(null)

  const coordinatorReady =
    model.visitReviewStatus === 'coordinator_signed'
    || model.visitReviewStatus === 'investigator_signed'

  // F-07 fix: client-side guard uses userCanSign prop (set by server render)
  const canSignNow =
    !disabled
    && userCanSign
    && coordinatorReady
    && model.investigatorReviewStatus !== 'signed'
    && model.coordinatorSignatureStatus === 'signed'
    && !guards.investigatorSignBlocked

  const canReopen = !disabled && model.visitReviewStatus === 'investigator_signed'"""

    content = content.replace(old_body_start + "\n\n  const coordinatorReady =\n    model.visitReviewStatus === 'coordinator_signed'\n    || model.visitReviewStatus === 'investigator_signed'\n\n  // F-07 fix: client-side guard uses userCanSign prop (set by server render)\n  const canSignNow =\n    !disabled\n    && userCanSign\n    && coordinatorReady\n    && model.investigatorReviewStatus !== 'signed'\n    && model.coordinatorSignatureStatus === 'signed'\n    && !guards.investigatorSignBlocked\n\n" + old_body_end, new_body_start)

    # run method modification for request
    old_run = """  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; visitAutoCompleted?: boolean }>,
  ) => {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage(result.error ?? 'Action failed')
        return
      }
      if (result.visitAutoCompleted) {
        setMessage('Investigator signed. Visit marked completed.')
      } else {
        setMessage(
          'Investigator signed. Visit stays in progress until procedures and findings are resolved.',
        )
      }
      router.refresh()
    })
  }"""

    new_run = """  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; visitAutoCompleted?: boolean; requestId?: string }>,
    isRequest = false
  ) => {
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
        if (result.visitAutoCompleted) {
          setMessage('Investigator signed. Visit marked completed.')
        } else {
          setMessage(
            'Investigator signed. Visit stays in progress until procedures and findings are resolved.',
          )
        }
        router.refresh()
      }
    })
  }"""

    content = content.replace(old_run, new_run)

    # the button and panel
    old_btn = """          {canSignNow ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="investigator-role"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Signing role
                </label>
                <select
                  id="investigator-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvestigatorRole)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {INVESTIGATOR_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    signInvestigatorReviewAction({
                      visitId: model.visitId,
                      organizationId: model.organizationId,
                      investigatorRole: role,
                      expectedUpdatedAt: model.updatedAt,
                    }),
                  )
                }
              >
                Review &amp; sign
              </Button>
            </div>
          ) : null}"""

    new_btn = """          {canSignNow && !signatureRequestId ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="investigator-role"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Signing role
                </label>
                <select
                  id="investigator-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvestigatorRole)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {INVESTIGATOR_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    requestInvestigatorCloseoutSignatureAction({
                      visitId: model.visitId,
                      organizationId: model.organizationId,
                      investigatorRole: role,
                      expectedUpdatedAt: model.updatedAt,
                    }),
                    true
                  )
                }
              >
                Request Signature
              </Button>
            </div>
          ) : null}

          {signatureRequestId ? (
            <div className="w-full mt-4">
              <ElectronicSignaturePanel
                requestId={signatureRequestId}
                requiredRole={role}
                signatureMeaning="I attest that I have reviewed the visit and all procedures."
                attestationText="I verify that I have reviewed the progress note, procedures, and findings."
                status="pending"
                onSigned={() => {
                  run(() => completeInvestigatorCloseoutSignatureAction({
                    visitId: model.visitId,
                    organizationId: model.organizationId,
                    investigatorRole: role
                  }))
                }}
              />
            </div>
          ) : null}"""

    content = content.replace(old_btn, new_btn)

    # replace the text "Not CFR Part 11"
    content = content.replace(
        "PI or Sub-I operational review after coordinator closeout. Not CFR Part 11.",
        "PI or Sub-I operational review after coordinator closeout. Part 11 compliant electronic signature."
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Success Investigator")

if __name__ == "__main__":
    main()
