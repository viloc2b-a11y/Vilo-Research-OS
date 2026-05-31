export const CONSENT_STATUSES = [
  'pending',
  'completed',
  'active',
  'superseded',
  'withdrawn',
  'expired',
  'invalidated',
] as const

export type ConsentStatus = (typeof CONSENT_STATUSES)[number]

export const CONSENT_TYPES = [
  'initial_consent',
  're_consent',
  'amendment_consent',
  'hipaa_authorization',
  'optional_consent',
  'future_use_consent',
  'genetic_consent',
] as const

export type ConsentType = (typeof CONSENT_TYPES)[number]

export const OPTIONAL_PERMISSION_TYPES = [
  'future_use_samples',
  'genetic_testing',
  'optional_specimen',
  'contact_for_future_research',
  'data_sharing',
] as const

export type OptionalPermissionType = (typeof OPTIONAL_PERMISSION_TYPES)[number]

export type OptionalPermissionStatus = 'not_asked' | 'granted' | 'declined' | 'withdrawn'

export type ConsentVersionRow = {
  id: string
  studySubjectId: string
  studyId: string
  organizationId: string
  consentType: ConsentType
  consentVersionLabel: string
  protocolVersion: string | null
  amendmentIdentifier: string | null
  consentDocumentVersionId: string | null
  language: string
  status: ConsentStatus
  effectiveAt: string | null
  expiresAt: string | null
  supersedesConsentVersionId: string | null
  supersededByConsentVersionId: string | null
  coordinatorSignatureRequestId: string | null
  piSignatureRequestId: string | null
  coordinatorSignatureStatus: string | null
  piSignatureStatus: string | null
  requiresPiReview: boolean
  completionMethod: 'electronic_patient_signature' | 'paper_signed_attested' | 'imported_legacy' | null
  consentDocumentUploadPending: boolean
  patientSignatureId: string | null
  larGuardianSignatureId: string | null
  witnessSignatureId: string | null
  completedAt: string | null
  activeAt: string | null
  lockedAt: string | null
  reason: string | null
  createdAt: string
}

export type ConsentEventRow = {
  id: string
  consentVersionId: string | null
  eventType: string
  eventStatus: ConsentStatus
  eventAt: string
  reason: string | null
  signatureRequestId: string | null
  signatureStatus: string | null
}

export type ConsentDocumentRow = {
  id: string
  consentVersionId: string | null
  consentEventId: string | null
  documentKind: string
  fileName: string
  filePath: string | null
  externalDocumentId: string | null
  linkedAt: string
}

export type ConsentOptionalPermissionRow = {
  id: string
  consentVersionId: string | null
  permissionType: OptionalPermissionType
  permissionStatus: OptionalPermissionStatus
  effectiveAt: string | null
  changedReason: string | null
  signatureRequestId: string | null
  signatureStatus: string | null
  updatedAt: string
}

export type ConsentWithdrawalRow = {
  id: string
  consentVersionId: string | null
  withdrawalScope: string
  reason: string
  withdrawnAt: string
  acknowledgmentSignatureRequestId: string | null
  acknowledgmentSignatureStatus: string | null
  acknowledgedAt: string | null
  lockedAt: string | null
}

export type MasterConsentDocumentVersionRow = {
  id: string
  studyId: string
  consentType: string
  versionNumber: number
  versionLabel: string | null
  irbApprovalDate: string | null
  effectiveDate: string
  expirationDate: string | null
  reconsentRequired: boolean
  requiredByDate: string | null
  amendmentIdentifier: string | null
  status: string
  reviewStatus: string
  extractionConfidence: number | null
  optionalClauseChanged: boolean
  language: string
}

export type ConsentDocumentClauseRow = {
  id: string
  consentDocumentVersionId: string
  clauseType: string
  clauseStatus: string
  extractedText: string | null
  extractionConfidence: number | null
  requiresOptionalPermission: boolean
  requiresReconsentOnChange: boolean
}

export type ReconsentRequirementRow = {
  id: string
  studySubjectId: string
  subjectIdentifier: string | null
  consentDocumentVersionId: string
  currentSubjectConsentVersionId: string | null
  consentOutdated: boolean
  reconsentRequired: boolean
  pendingConsentVersionId: string | null
  consentActionRequired: boolean
  reconsentDueDate: string | null
  reconsentStatus: 'not_required' | 'pending' | 'overdue' | 'completed' | 'waived'
  reason: string
  detectedAt: string
}

export type PatientConsentSessionRow = {
  id: string
  consentDocumentVersionId: string | null
  subjectConsentVersionId: string | null
  tokenHint: string
  scope: 'consent_only'
  language: 'en' | 'es'
  status: string
  expiresAt: string
  sentAt: string | null
  lastViewedAt: string | null
  createdAt: string
}

export type PatientConsentSignatureRow = {
  id: string
  patientSessionId: string
  subjectConsentVersionId: string | null
  consentEventId: string | null
  signerType: 'patient' | 'lar_guardian' | 'witness'
  signerName: string
  signatureMethod: string
  signedAt: string
}

export type PatientConsentPortalModel = {
  tokenHint: string
  language: 'en' | 'es'
  status: string
  expiresAt: string
  subjectIdentifier: string | null
  consentVersionLabel: string | null
  consentType: string | null
  masterVersionLabel: string | null
  masterVersionNumber: number | null
  documentStatus: string | null
  clauses: ConsentDocumentClauseRow[]
  existingSignatures: PatientConsentSignatureRow[]
}

export type SubjectConsentRuntimeModel = {
  subjectId: string
  studyId: string
  organizationId: string
  legacyConsentSignedAt: string | null
  legacyConsentVersionId: string | null
  legacyPrivacyConsent: boolean
  currentStatus: ConsentStatus | 'not_started'
  activeConsent: ConsentVersionRow | null
  activeHipaa: ConsentVersionRow | null
  hasWithdrawal: boolean
  versions: ConsentVersionRow[]
  events: ConsentEventRow[]
  documents: ConsentDocumentRow[]
  optionalPermissions: ConsentOptionalPermissionRow[]
  withdrawals: ConsentWithdrawalRow[]
  masterVersions: MasterConsentDocumentVersionRow[]
  clauses: ConsentDocumentClauseRow[]
  reconsentRequirements: ReconsentRequirementRow[]
  patientSessions: PatientConsentSessionRow[]
  patientSignatures: PatientConsentSignatureRow[]
}
