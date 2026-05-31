import { readFileSync } from 'node:fs'

function assertContains(source: string, pattern: string | RegExp, label: string) {
  const ok = typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source)
  if (!ok) throw new Error(`Missing expected consent runtime surface: ${label}`)
}

function assertNotContains(source: string, pattern: string | RegExp, label: string) {
  const ok = typeof pattern === 'string' ? !source.includes(pattern) : !pattern.test(source)
  if (!ok) throw new Error(`Forbidden consent runtime pattern detected: ${label}`)
}

function main() {
  const actions = readFileSync('lib/subject/consent/actions.ts', 'utf8')
  const guards = readFileSync('lib/subject/consent/guards.ts', 'utf8')
  const enforcement = readFileSync('lib/subject/consent/enforcement.ts', 'utf8')
  const panel = readFileSync('components/subject/consent/SubjectConsentRuntimePanel.tsx', 'utf8')
  const portal = readFileSync('components/subject/consent/PatientConsentPortal.tsx', 'utf8')
  const portalPage = readFileSync('app/consent/[token]/page.tsx', 'utf8')
  const patientViewRoute = readFileSync('app/api/subject-consent/patient-session/view/route.ts', 'utf8')
  const patientSignRoute = readFileSync('app/api/subject-consent/patient-session/sign/route.ts', 'utf8')

  assertContains(actions, 'createConsentVersionFromDocumentReaderAction', 'Document Reader consent mapper')
  assertContains(actions, "status: needsReview ? 'review_needed' : 'irb_approved'", 'low-confidence review-needed state')
  assertContains(actions, 'consent_document_versions', 'master consent version registry')
  assertContains(actions, 'consent_document_clauses', 'structured consent clauses')
  assertContains(actions, 'detectReconsentRequirementsForStudy', 'reconsent detection engine')
  assertContains(actions, '.or(\'reconsent_required.eq.true,optional_clause_changed.eq.true\')', 'optional clause reconsent detection')
  assertContains(actions, 'listReconsentQueue', 'reconsent queue helper')
  assertContains(actions, 'viewPatientConsentSessionAction', 'patient session view audit')
  assertContains(actions, 'loadPatientConsentPortalAction', 'patient portal loader')
  assertContains(actions, 'recordPatientConsentSignatureAction', 'patient signature by token')
  assertContains(actions, 'updateConsentDocumentVersionReviewAction', 'review metadata edit action')
  assertContains(actions, 'approveConsentDocumentVersionReviewAction', 'review approve activation action')
  assertContains(actions, 'rejectConsentDocumentVersionReviewAction', 'review reject action')
  assertContains(actions, 'attestPaperConsentAction', 'paper consent attestation')
  assertContains(actions, 'importLegacyConsentAction', 'imported legacy completion')
  assertContains(actions, 'consent_document_upload_pending', 'upload pending metadata')
  assertContains(actions, 'CONSENT_DOCUMENT_LINKED_AFTER_ATTESTATION', 'later upload audit action')
  assertContains(actions, 'hasConsentCompletionEvidence', 'completion evidence gate')
  assertContains(actions, 'operational_signature_requests', 'staff/PI operational signature check')
  assertNotContains(actions, /from\(['"]operational_signatures['"]\)/, 'manual operational_signatures table writes')

  assertContains(guards, 'hasActiveHIPAAAuthorization', 'HIPAA guard')
  assertContains(guards, "withdrawalScopeForPermission(permissionType)", 'withdrawal scope mapping')
  assertContains(enforcement, 'enforceConsentForProcedureExecution', 'procedure enforcement helper')
  assertContains(enforcement, 'CONSENT_RUNTIME_BLOCKED', 'runtime block audit event')
  assertContains(enforcement, 'CONSENT_RUNTIME_OPTIONAL_NOT_APPLICABLE', 'optional applicability block event')

  assertContains(panel, 'Paper Consent Attestation', 'coordinator paper attestation UI')
  assertContains(panel, 'Imported Legacy Consent', 'legacy import UI')
  assertContains(panel, 'Patient eConsent Access', 'patient eConsent UI')
  assertContains(panel, 'CRC Consent Dashboard', 'CRC dashboard')
  assertContains(panel, 'Consent Review Queue', 'Document Reader review queue UI')
  assertContains(panel, 'Approve & Activate', 'review approval activation UI')
  assertContains(panel, 'Revoke', 'magic link revoke operation')
  assertContains(panel, 'document upload pending', 'upload pending UI badge')
  assertContains(panel, 'Patient/LAR/Witness Signatures', 'patient signature visibility')

  assertContains(portalPage, 'loadPatientConsentPortalAction', 'public portal page loader')
  assertContains(portal, 'Verify Subject', 'portal subject verification step')
  assertContains(portal, 'Read Consent', 'portal read consent step')
  assertContains(portal, 'Review Clauses', 'portal clause review step')
  assertContains(portal, 'lar_guardian', 'portal LAR signature support')
  assertContains(portal, 'witness', 'portal witness signature support')
  assertContains(portal, '/api/subject-consent/patient-session/sign', 'portal signature API call')

  assertContains(patientViewRoute, 'viewPatientConsentSessionAction', 'patient view route')
  assertContains(patientSignRoute, 'recordPatientConsentSignatureAction', 'patient sign route')

  console.log(JSON.stringify({
    status: 'PASS',
    mode: 'static-no-db-mutation',
    validates: [
      'Document Reader mapping',
      'master consent registry',
      'clause extraction',
      'reconsent detection and queue',
      'patient eConsent token routes',
      'paper consent attestation',
      'upload pending workflow',
      'staff/PI operational signature gate',
      'runtime enforcement helper wiring',
      'public patient eConsent portal',
      'magic link operations',
      'Document Reader review queue and activation',
      'CRC consent dashboard',
    ],
  }, null, 2))
}

main()
