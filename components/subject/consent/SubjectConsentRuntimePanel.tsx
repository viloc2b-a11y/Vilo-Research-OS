'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'
import {
  completeConsentSignatureAction,
  approveConsentDocumentVersionReviewAction,
  attestPaperConsentAction,
  createMasterConsentVersionAction,
  createPatientConsentSessionAction,
  createConsentVersionAction,
  detectReconsentRequirementsForStudy,
  importLegacyConsentAction,
  rejectConsentDocumentVersionReviewAction,
  requestConsentSignatureAction,
  revokePatientConsentSessionAction,
  supersedeConsentAction,
  updateConsentDocumentVersionReviewAction,
  updateOptionalConsentPermissionAction,
  uploadLinkConsentDocumentAction,
  withdrawConsentAction,
} from '@/lib/subject/consent/actions'
import type {
  ConsentType,
  ConsentVersionRow,
  MasterConsentDocumentVersionRow,
  OptionalPermissionStatus,
  OptionalPermissionType,
  PatientConsentSessionRow,
  SubjectConsentRuntimeModel,
} from '@/lib/subject/consent/types'

type SubjectConsentRuntimePanelProps = {
  model: SubjectConsentRuntimeModel
  canMutate: boolean
}

const consentTypes: { value: ConsentType; label: string }[] = [
  { value: 'initial_consent', label: 'Initial Consent' },
  { value: 're_consent', label: 'Re-Consent' },
  { value: 'amendment_consent', label: 'Amendment Consent' },
  { value: 'hipaa_authorization', label: 'HIPAA Authorization' },
  { value: 'optional_consent', label: 'Optional Consent' },
  { value: 'future_use_consent', label: 'Future Use Consent' },
  { value: 'genetic_consent', label: 'Genetic Consent' },
]

const permissionTypes: { value: OptionalPermissionType; label: string }[] = [
  { value: 'future_use_samples', label: 'Future Use Samples' },
  { value: 'genetic_testing', label: 'Genetic Testing' },
  { value: 'optional_specimen', label: 'Optional Specimen' },
  { value: 'contact_for_future_research', label: 'Contact for Future Research' },
  { value: 'data_sharing', label: 'Data Sharing' },
]

const permissionStatuses: OptionalPermissionStatus[] = [
  'not_asked',
  'granted',
  'declined',
  'withdrawn',
]

export function SubjectConsentRuntimePanel({
  model,
  canMutate,
}: SubjectConsentRuntimePanelProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consentType, setConsentType] = useState<ConsentType>('initial_consent')
  const [versionLabel, setVersionLabel] = useState('')
  const [protocolVersion, setProtocolVersion] = useState('')
  const [amendmentIdentifier, setAmendmentIdentifier] = useState('')
  const [reason, setReason] = useState('')
  const [requiresPiReview, setRequiresPiReview] = useState(false)
  const [documentVersionId, setDocumentVersionId] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentPath, setDocumentPath] = useState('')
  const [permissionType, setPermissionType] = useState<OptionalPermissionType>('future_use_samples')
  const [permissionStatus, setPermissionStatus] = useState<OptionalPermissionStatus>('granted')
  const [permissionReason, setPermissionReason] = useState('')
  const [withdrawalVersionId, setWithdrawalVersionId] = useState('')
  const [withdrawalScope, setWithdrawalScope] = useState('all_study')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [masterVersionNumber, setMasterVersionNumber] = useState('1')
  const [masterEffectiveDate, setMasterEffectiveDate] = useState('')
  const [masterIrbDate, setMasterIrbDate] = useState('')
  const [masterRequiredBy, setMasterRequiredBy] = useState('')
  const [masterReconsentRequired, setMasterReconsentRequired] = useState(false)
  const [econsentLanguage, setEconsentLanguage] = useState<'en' | 'es'>('en')
  const [paperConsentDateTime, setPaperConsentDateTime] = useState('')
  const [paperUploadLater, setPaperUploadLater] = useState(true)
  const [legacyConsentDateTime, setLegacyConsentDateTime] = useState('')
  const [legacyReason, setLegacyReason] = useState('')
  const [lastMagicLink, setLastMagicLink] = useState<string | null>(null)

  const currentStatusLabel = useMemo(() => {
    if (model.hasWithdrawal) return 'withdrawn'
    return model.activeConsent?.status ?? model.currentStatus
  }, [model])
  const dashboard = useMemo(() => ({
    pendingPatientSignatures: model.patientSessions.filter((session) => ['sent', 'active', 'viewed'].includes(sessionStatus(session))).length,
    pendingReconsents: model.reconsentRequirements.filter((row) => ['pending', 'overdue'].includes(row.reconsentStatus)).length,
    expiredLinks: model.patientSessions.filter((session) => sessionStatus(session) === 'expired').length,
    pendingConsentReview: model.masterVersions.filter((version) => version.status === 'review_needed' || version.reviewStatus === 'needs_review').length,
    uploadPendingPaperConsents: model.versions.filter((version) => version.consentDocumentUploadPending).length,
  }), [model])

  function run(action: () => Promise<unknown>, success: string) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        await action()
        setMessage(success)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Consent action failed.')
      }
    })
  }

  function createVersion() {
    run(
      () =>
        createConsentVersionAction(model.subjectId, {
          consentType,
          consentDocumentVersionId: model.masterVersions.find((version) => version.status === 'active')?.id,
          consentVersionLabel: versionLabel,
          protocolVersion,
          amendmentIdentifier,
          requiresPiReview,
          supersedesConsentVersionId: consentType === 'amendment_consent'
            ? model.activeConsent?.id
            : undefined,
          reason,
        }),
      'Consent version created. Request signatures when ready.',
    )
  }

  function createMasterVersion() {
    run(
      () =>
        createMasterConsentVersionAction(model.studyId, {
          consentType: consentTypeToMaster(consentType),
          versionNumber: Number(masterVersionNumber),
          versionLabel,
          irbApprovalDate: masterIrbDate,
          effectiveDate: masterEffectiveDate,
          reconsentRequired: masterReconsentRequired,
          requiredByDate: masterRequiredBy,
          amendmentIdentifier,
          status: 'active',
        }),
      'Master consent version created/activated and reconsent detection executed when required.',
    )
  }

  function runDetection() {
    run(
      () => detectReconsentRequirementsForStudy(model.studyId),
      'Reconsent detection completed for this study.',
    )
  }

  function createPatientSession() {
    run(
      async () => {
        const result = await createPatientConsentSessionAction({
          subjectId: model.subjectId,
          consentDocumentVersionId: model.masterVersions.find((version) => version.status === 'active')?.id,
          subjectConsentVersionId: model.activeConsent?.id ?? undefined,
          language: econsentLanguage,
        })
        const link = `${window.location.origin}/consent/${result.accessToken}`
        setLastMagicLink(link)
        setMessage(`Patient eConsent session created. Link: ${link} expires ${new Date(result.expiresAt).toLocaleString()}`)
      },
      'Patient eConsent session created.',
    )
  }

  function revokePatientSession(session: PatientConsentSessionRow) {
    run(
      () => revokePatientConsentSessionAction(session.id, 'Revoked from Consent Runtime CRC panel.'),
      'Patient eConsent link revoked.',
    )
  }

  function attestPaperConsent() {
    run(
      () =>
        attestPaperConsentAction(model.subjectId, {
          consentDocumentVersionId: model.masterVersions.find((version) => version.status === 'active')?.id,
          consentType,
          consentVersionLabel: versionLabel || 'Paper consent attestation',
          consentDateTime: paperConsentDateTime,
          requiresPiReview,
          uploadLater: paperUploadLater,
          reason: reason || 'Paper consent attested by coordinator.',
        }),
      'Paper consent recorded. Complete the coordinator PIN signature to activate it; document upload can follow later.',
    )
  }

  function importLegacyConsent() {
    run(
      () =>
        importLegacyConsentAction(model.subjectId, {
          consentDocumentVersionId: model.masterVersions.find((version) => version.status === 'active')?.id,
          consentType,
          consentVersionLabel: versionLabel || 'Imported legacy consent',
          consentDateTime: legacyConsentDateTime,
          reason: legacyReason,
        }),
      'Legacy consent imported and locked with audit trail.',
    )
  }

  function linkDocument() {
    run(
      () =>
        uploadLinkConsentDocumentAction(model.subjectId, {
          consentVersionId: documentVersionId || undefined,
          documentKind: consentType === 'hipaa_authorization' ? 'hipaa' : 'icf',
          fileName: documentName,
          filePath: documentPath,
        }),
      'Consent document linked.',
    )
  }

  function updatePermission() {
    run(
      () =>
        updateOptionalConsentPermissionAction(model.subjectId, {
          consentVersionId: model.activeConsent?.id,
          permissionType,
          permissionStatus,
          reason: permissionReason,
        }),
      'Optional consent permission updated.',
    )
  }

  function withdraw() {
    run(
      () =>
        withdrawConsentAction(model.subjectId, {
          consentVersionId: withdrawalVersionId || model.activeConsent?.id || undefined,
          withdrawalScope,
          reason: withdrawalReason,
        }),
      'Withdrawal recorded. Request acknowledgment signature if required.',
    )
  }

  function requestVersionSignature(version: ConsentVersionRow, signer: 'coordinator' | 'pi') {
    run(
      () =>
        requestConsentSignatureAction({
          targetType: 'version',
          targetId: version.id,
          signer,
        }),
      `${signer} signature requested.`,
    )
  }

  function completeVersionSignature(version: ConsentVersionRow, signer: 'coordinator' | 'pi') {
    run(
      () =>
        completeConsentSignatureAction({
          targetType: 'version',
          targetId: version.id,
          signer,
        }),
      'Consent signature recorded and state refreshed.',
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CRC Consent Dashboard</CardTitle>
          <CardDescription>Operational queues for consent follow-up.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <StatusTile label="Patient signatures" value={String(dashboard.pendingPatientSignatures)} />
          <StatusTile label="Reconsents" value={String(dashboard.pendingReconsents)} />
          <StatusTile label="Expired links" value={String(dashboard.expiredLinks)} />
          <StatusTile label="Review queue" value={String(dashboard.pendingConsentReview)} />
          <StatusTile label="Upload pending" value={String(dashboard.uploadPendingPaperConsents)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consent Runtime</CardTitle>
          <CardDescription>
            Operational consent state, documents, optional permissions, withdrawals, and signature
            requests for this subject.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <StatusTile label="Current status" value={currentStatusLabel} />
          <StatusTile label="Active ICF" value={model.activeConsent?.consentVersionLabel ?? 'None'} />
          <StatusTile label="HIPAA" value={model.activeHipaa ? 'Active' : 'Not active'} />
          <StatusTile
            label="Legacy sync"
            value={model.legacyConsentSignedAt ? 'consent_signed_at set' : 'Not synced'}
          />
        </CardContent>
      </Card>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      {canMutate ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Consent Version</CardTitle>
              <CardDescription>Initial consent, re-consent, amendments, HIPAA, and optional consent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm font-medium">
                Consent type
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={consentType}
                  onChange={(event) => setConsentType(event.target.value as ConsentType)}
                >
                  {consentTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <Input placeholder="Consent version label" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Protocol version" value={protocolVersion} onChange={(event) => setProtocolVersion(event.target.value)} />
                <Input placeholder="Amendment ID" value={amendmentIdentifier} onChange={(event) => setAmendmentIdentifier(event.target.value)} />
              </div>
              <Input placeholder="Reason (required for amendment/re-consent)" value={reason} onChange={(event) => setReason(event.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requiresPiReview} onChange={(event) => setRequiresPiReview(event.target.checked)} />
                PI/Sub-I review required
              </label>
              <Button onClick={createVersion} disabled={isPending || !versionLabel.trim()}>
                Create Consent
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link Consent Document</CardTitle>
              <CardDescription>Attach an ICF, HIPAA, optional consent, or withdrawal document reference.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <VersionSelect versions={model.versions} value={documentVersionId} onChange={setDocumentVersionId} />
              <Input placeholder="Document file name" value={documentName} onChange={(event) => setDocumentName(event.target.value)} />
              <Input placeholder="File path or external link/reference" value={documentPath} onChange={(event) => setDocumentPath(event.target.value)} />
              <Button onClick={linkDocument} disabled={isPending || !documentName.trim()}>
                Link Document
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Optional Consent Permissions</CardTitle>
              <CardDescription>Changes here do not invalidate the main ICF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={permissionType} onChange={(event) => setPermissionType(event.target.value as OptionalPermissionType)}>
                {permissionTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={permissionStatus} onChange={(event) => setPermissionStatus(event.target.value as OptionalPermissionStatus)}>
                {permissionStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <Input placeholder="Reason for permission change" value={permissionReason} onChange={(event) => setPermissionReason(event.target.value)} />
              <Button onClick={updatePermission} disabled={isPending || !permissionReason.trim()}>
                Update Permission
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Withdrawal of Consent</CardTitle>
              <CardDescription>Records withdrawal and prepares acknowledgment signature.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <VersionSelect versions={model.versions} value={withdrawalVersionId} onChange={setWithdrawalVersionId} />
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={withdrawalScope} onChange={(event) => setWithdrawalScope(event.target.value)}>
                <option value="all_study">All study</option>
                <option value="study_treatment">Study treatment</option>
                <option value="optional_samples">Optional samples</option>
                <option value="future_use">Future use</option>
                <option value="hipaa">HIPAA</option>
                <option value="genetic">Genetic</option>
              </select>
              <Input placeholder="Withdrawal reason" value={withdrawalReason} onChange={(event) => setWithdrawalReason(event.target.value)} />
              <Button onClick={withdraw} disabled={isPending || !withdrawalReason.trim()}>
                Record Withdrawal
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {canMutate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Master Consent Registry & Reconsent Engine</CardTitle>
            <CardDescription>
              Active study consent document versions drive reconsent detection and runtime guards.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-4">
            <Input placeholder="Version #" value={masterVersionNumber} onChange={(event) => setMasterVersionNumber(event.target.value)} />
            <Input type="date" placeholder="IRB approval" value={masterIrbDate} onChange={(event) => setMasterIrbDate(event.target.value)} />
            <Input type="date" placeholder="Effective date" value={masterEffectiveDate} onChange={(event) => setMasterEffectiveDate(event.target.value)} />
            <Input type="date" placeholder="Required by" value={masterRequiredBy} onChange={(event) => setMasterRequiredBy(event.target.value)} />
            <label className="flex items-center gap-2 text-sm lg:col-span-2">
              <input type="checkbox" checked={masterReconsentRequired} onChange={(event) => setMasterReconsentRequired(event.target.checked)} />
              Reconsent required for this active version
            </label>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Button onClick={createMasterVersion} disabled={isPending || !masterEffectiveDate || !versionLabel.trim()}>
                Create Active Master Version
              </Button>
              <Button variant="outline" onClick={runDetection} disabled={isPending}>
                Run Detection
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canMutate ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paper Consent Attestation</CardTitle>
              <CardDescription>
                Use when the subject/LAR signed paper before study procedures. PDF upload is a follow-up, not a runtime blocker.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="datetime-local"
                value={paperConsentDateTime}
                onChange={(event) => setPaperConsentDateTime(event.target.value)}
              />
              <label className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={paperUploadLater}
                  onChange={(event) => setPaperUploadLater(event.target.checked)}
                />
                <span>Upload signed document later; keep compliance follow-up pending.</span>
              </label>
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                I attest that the subject/LAR signed the correct paper consent version before any study procedure, and that the signed document will be uploaded or linked to the subject record.
              </p>
              <Button onClick={attestPaperConsent} disabled={isPending || !paperConsentDateTime}>
                Record Paper Consent
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imported Legacy Consent</CardTitle>
              <CardDescription>
                Backfill a valid historical consent with audit reason. Use only for verified legacy records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="datetime-local"
                value={legacyConsentDateTime}
                onChange={(event) => setLegacyConsentDateTime(event.target.value)}
              />
              <Input
                placeholder="Import reason / source"
                value={legacyReason}
                onChange={(event) => setLegacyReason(event.target.value)}
              />
              <Button onClick={importLegacyConsent} disabled={isPending || !legacyConsentDateTime || !legacyReason.trim()}>
                Import Legacy Consent
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {canMutate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient eConsent Access</CardTitle>
            <CardDescription>Creates a secure expiring consent-only token. Staff cannot sign as patient.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              Language
              <select className="mt-1 block rounded-md border px-3 py-2 text-sm" value={econsentLanguage} onChange={(event) => setEconsentLanguage(event.target.value as 'en' | 'es')}>
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </label>
            <Button onClick={createPatientSession} disabled={isPending}>
              Create/Resend Patient Link
            </Button>
            {lastMagicLink ? (
              <div className="w-full rounded-md border bg-muted/30 px-3 py-2 text-xs">
                Magic link: <span className="break-all font-medium">{lastMagicLink}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canMutate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consent Review Queue</CardTitle>
            <CardDescription>Review low-confidence Document Reader consent versions before activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {model.masterVersions.filter(isReviewNeeded).length === 0 ? (
              <p className="text-sm text-muted-foreground">No consent documents are pending review.</p>
            ) : (
              model.masterVersions.filter(isReviewNeeded).map((version) => (
                <ConsentReviewItem
                  key={version.id}
                  version={version}
                  clauses={model.clauses.filter((clause) => clause.consentDocumentVersionId === version.id)}
                  onRun={run}
                />
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consent Versions & Signatures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {model.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consent versions recorded yet.</p>
          ) : (
            model.versions.map((version) => (
              <div key={version.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{version.consentVersionLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {version.consentType} · {version.status} · created {formatDate(version.createdAt)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {version.completionMethod ? <Badge>{version.completionMethod}</Badge> : null}
                      {version.consentDocumentUploadPending ? <Badge>document upload pending</Badge> : null}
                    </div>
                    {version.reason ? <div className="mt-1 text-xs text-muted-foreground">Reason: {version.reason}</div> : null}
                  </div>
                  {canMutate && version.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => run(() => supersedeConsentAction({ consentVersionId: version.id, reason: 'Superseded from Consent Runtime UI' }), 'Consent superseded.')}
                    >
                      Supersede
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <SignatureBox
                    label="Coordinator obtaining consent"
                    requestId={version.coordinatorSignatureRequestId}
                    status={signatureStatus(version.coordinatorSignatureStatus)}
                    requiredRole="research_coordinator"
                    onRequest={() => requestVersionSignature(version, 'coordinator')}
                    onSigned={() => completeVersionSignature(version, 'coordinator')}
                    canMutate={canMutate}
                  />
                  {version.requiresPiReview ? (
                    <SignatureBox
                      label="PI/Sub-I review"
                      requestId={version.piSignatureRequestId}
                      status={signatureStatus(version.piSignatureStatus)}
                      requiredRole="pi_sub_i"
                      onRequest={() => requestVersionSignature(version, 'pi')}
                      onSigned={() => completeVersionSignature(version, 'pi')}
                      canMutate={canMutate}
                    />
                  ) : (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                      PI review not required for this consent version.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <HistoryCard title="Master Consent Versions" rows={model.masterVersions.map((row) => `${row.consentType} v${row.versionNumber} · ${row.status} · reconsent=${row.reconsentRequired}`)} />
        <HistoryCard title="Reconsent Queue" rows={model.reconsentRequirements.map((row) => `${row.reconsentStatus}: ${row.reason}`)} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient eConsent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {model.patientSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patient sessions.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {model.patientSessions.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span>{sessionStatus(row)} · {row.language.toUpperCase()} · expires {formatDate(row.expiresAt)} · token {row.tokenHint}...</span>
                    {canMutate && !['revoked', 'expired', 'signed'].includes(sessionStatus(row)) ? (
                      <Button variant="outline" size="sm" onClick={() => revokePatientSession(row)}>Revoke</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <HistoryCard title="Patient/LAR/Witness Signatures" rows={model.patientSignatures.map((row) => `${row.signerType}: ${row.signerName} · ${formatDate(row.signedAt)}`)} />
        <HistoryCard title="Extracted Clauses" rows={model.clauses.map((row) => `${row.clauseType}: ${row.clauseStatus}`)} />
        <HistoryCard title="Optional Permissions" rows={model.optionalPermissions.map((row) => `${row.permissionType}: ${row.permissionStatus}`)} />
        <HistoryCard title="Withdrawals" rows={model.withdrawals.map((row) => `${row.withdrawalScope}: ${row.reason}`)} />
        <HistoryCard title="Documents" rows={model.documents.map((row) => `${row.documentKind}: ${row.fileName}`)} />
        <HistoryCard title="Consent Events" rows={model.events.map((row) => `${formatDate(row.eventAt)} · ${row.eventType} · ${row.eventStatus}`)} />
      </div>
    </div>
  )
}

function consentTypeToMaster(consentType: ConsentType) {
  if (consentType === 'hipaa_authorization') return 'hipaa_authorization'
  if (consentType === 'genetic_consent') return 'genetic_testing'
  if (consentType === 'future_use_consent') return 'optional_future_use'
  if (consentType === 'optional_consent') return 'biospecimen_storage'
  return 'main_icf'
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
      {children}
    </span>
  )
}

function ConsentReviewItem({
  version,
  clauses,
  onRun,
}: {
  version: MasterConsentDocumentVersionRow
  clauses: SubjectConsentRuntimeModel['clauses']
  onRun: (action: () => Promise<unknown>, success: string) => void
}) {
  const [versionLabel, setVersionLabel] = useState(version.versionLabel ?? '')
  const [versionNumber, setVersionNumber] = useState(String(version.versionNumber))
  const [irbDate, setIrbDate] = useState(version.irbApprovalDate ?? '')
  const [effectiveDate, setEffectiveDate] = useState(version.effectiveDate)
  const [requiredByDate, setRequiredByDate] = useState(version.requiredByDate ?? '')
  const [reconsentRequired, setReconsentRequired] = useState(version.reconsentRequired)
  const [optionalClauseChanged, setOptionalClauseChanged] = useState(version.optionalClauseChanged)
  const [reason, setReason] = useState('')

  function save() {
    onRun(
      () =>
        updateConsentDocumentVersionReviewAction(version.id, {
          versionLabel,
          versionNumber: Number(versionNumber),
          irbApprovalDate: irbDate,
          effectiveDate,
          requiredByDate,
          reconsentRequired,
          optionalClauseChanged,
          reason,
        }),
      'Consent review metadata saved.',
    )
  }

  function approve() {
    onRun(
      () => approveConsentDocumentVersionReviewAction(version.id, reason || 'Approved from Consent Review Queue.'),
      'Consent document approved, activated, and reconsent detection triggered.',
    )
  }

  function reject() {
    onRun(
      () => rejectConsentDocumentVersionReviewAction(version.id, reason || 'Rejected from Consent Review Queue.'),
      'Consent document extraction rejected.',
    )
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-medium">{version.consentType} v{version.versionNumber}</div>
          <div className="text-xs text-muted-foreground">
            {version.status} · review {version.reviewStatus} · confidence {version.extractionConfidence ?? 'n/a'}
          </div>
        </div>
        <Badge>review needed</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="Version label" />
        <Input value={versionNumber} onChange={(event) => setVersionNumber(event.target.value)} placeholder="Version #" />
        <Input type="date" value={irbDate} onChange={(event) => setIrbDate(event.target.value)} />
        <Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        <Input type="date" value={requiredByDate} onChange={(event) => setRequiredByDate(event.target.value)} />
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Review reason" />
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reconsentRequired} onChange={(event) => setReconsentRequired(event.target.checked)} />
          Reconsent required
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={optionalClauseChanged} onChange={(event) => setOptionalClauseChanged(event.target.checked)} />
          Optional clause changed
        </label>
      </div>
      <div className="mt-3 space-y-2">
        {clauses.map((clause) => (
          <div key={clause.id} className="rounded-md bg-muted/30 px-3 py-2 text-xs">
            {clause.clauseType}: {clause.clauseStatus}
            {clause.extractionConfidence !== null ? ` · confidence ${clause.extractionConfidence}` : ''}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={save}>Save Metadata</Button>
        <Button onClick={approve}>Approve & Activate</Button>
        <Button variant="destructive" onClick={reject}>Reject</Button>
      </div>
    </div>
  )
}

function isReviewNeeded(version: MasterConsentDocumentVersionRow) {
  return version.status === 'review_needed' || version.reviewStatus === 'needs_review'
}

function sessionStatus(session: PatientConsentSessionRow) {
  if (new Date(session.expiresAt).getTime() < Date.now() && !['signed', 'revoked'].includes(session.status)) {
    return 'expired'
  }
  if (session.status === 'active' && session.sentAt) return 'sent'
  return session.status
}

function VersionSelect({
  versions,
  value,
  onChange,
}: {
  versions: ConsentVersionRow[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select className="w-full rounded-md border px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Current/none</option>
      {versions.map((version) => (
        <option key={version.id} value={version.id}>
          {version.consentVersionLabel} ({version.status})
        </option>
      ))}
    </select>
  )
}

function SignatureBox({
  label,
  requestId,
  status,
  requiredRole,
  onRequest,
  onSigned,
  canMutate,
}: {
  label: string
  requestId: string | null
  status: 'pending' | 'signed' | 'cancelled' | 'superseded'
  requiredRole: string
  onRequest: () => void
  onSigned: () => void
  canMutate: boolean
}) {
  if (!requestId) {
    return (
      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-1 text-xs text-muted-foreground">No signature request yet.</p>
        {canMutate ? <Button className="mt-3" size="sm" onClick={onRequest}>Request Signature</Button> : null}
      </div>
    )
  }
  return (
    <ElectronicSignaturePanel
      requestId={requestId}
      signatureMeaning={label}
      attestationText="I confirm this consent record is accurate, complete, and attributable to my role."
      requiredRole={requiredRole}
      status={status}
      onSigned={onSigned}
    />
  )
}

function HistoryCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((row, index) => (
              <li key={`${row}-${index}`} className="rounded-md border px-3 py-2">{row}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function signatureStatus(status: string | null): 'pending' | 'signed' | 'cancelled' | 'superseded' {
  if (status === 'signed' || status === 'cancelled' || status === 'superseded') return status
  return 'pending'
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}
