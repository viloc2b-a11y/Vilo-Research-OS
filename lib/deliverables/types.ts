export type DeliverableAudience = 'coordinator' | 'investigator' | 'cra' | 'sponsor' | 'finance' | 'qa' | 'inspection'
export type DeliverableScope = 'study' | 'subject' | 'visit' | 'procedure' | 'subject_cohort'
export type DeliverableFormat = 'pdf' | 'xlsx' | 'csv' | 'zip'
export type OutputFormat = DeliverableFormat
export type VersionLogic = 'VERSION_USED_DURING_EXECUTION' | 'ALL_EXECUTED_VERSIONS' | 'SPECIFIC_VERSION' | 'CURRENT_ACTIVE_VERSION'
export type DeliverableRunStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type EvidenceType = 'clinical_fields' | 'signatures' | 'consent' | 'audit_trail' | 'financials'
export type DeliverablePurpose = 'offline_source' | 'monitoring' | 'financial_reconciliation' | 'evidence_package'
export type SubjectCohort = 'Randomized' | 'Screen Failed' | 'Active' | 'Completed' | 'Discontinued' | 'Lost To Follow-Up'

export interface DeliverableDefinition {
  id: string
  organizationId: string
  systemCode: string
  name: string
  targetAudience: DeliverableAudience[]
  allowedFormats: DeliverableFormat[]
  scopeModel: DeliverableScope
  evidenceRules: {
    includedTypes: EvidenceType[]
    excludedTypes: string[]
    versionLogic: VersionLogic
  }
}

export interface VisitScope {
  studyId: string
  subjectId: string
  visitInstanceId: string
}

export interface SubjectScope {
  studyId: string
  subjectId?: string
  cohort?: SubjectCohort
}

export interface ProcedureScope {
  studyId: string
  subjectId: string
  visitInstanceId: string
  procedureId: string
}

export interface DeliverableRunFilters {
  runId: string
  studyId: string
  subjectId?: string
  visitInstanceId?: string
  options: Record<string, unknown>
}

export interface DeliverableRun {
  id: string
  organizationId: string
  definitionId: string
  status: DeliverableRunStatus
  runBy: string
  startedAt?: Date
  completedAt?: Date
  filters?: SubjectScope | VisitScope | ProcedureScope
  metrics?: Record<string, unknown>
  outputs?: unknown[]
}

export interface DeliverableWarning {
  code: 'NO_VISITS_EXECUTED' | 'NO_SOURCE_PACKAGE_ID' | 'VERSION_MISMATCH' | 'PHI_RISK' | 'LARGE_PAYLOAD'
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export interface DeliverablePreview {
  estimatedRows: number
  estimatedPages?: number
  subjectsCount: number
  visitsCount: number
  proposedFilename: string
  warnings: DeliverableWarning[]
}

export type CRAMonitoringWorkbookReadinessStatus = 'PASS' | 'WARNING' | 'BLOCKED'

export type CRAMonitoringWorkbookReadinessCheckStatus = 'pass' | 'warning' | 'blocker'

export interface CRAMonitoringWorkbookReadinessCheck {
  id: string
  label: string
  status: CRAMonitoringWorkbookReadinessCheckStatus
  detail: string
}

export interface CRAMonitoringWorkbookReadinessResult {
  status: CRAMonitoringWorkbookReadinessStatus
  badgeLabel: 'READY' | 'READY WITH WARNINGS' | 'BLOCKED'
  checkedAt: string
  studyId: string
  studyName: string
  protocolNumber: string | null
  siteName: string
  checks: CRAMonitoringWorkbookReadinessCheck[]
  blockers: string[]
  warnings: string[]
}

// Printable Source Packet Specific Types
export interface PrintableSourceAuditReference {
  eventId: string
  action: string
  timestamp: string
  actorId: string
}

export interface PrintableSourceAttachmentEvidence {
  id: string
  filename: string
  url: string
  version: number
  uploadedAt: string
}

export interface PrintableSourceSignatureEvidence {
  signer: string
  role: string
  meaning: string
  signedAt: string
  hash?: string
}

export interface PrintableSourceFieldEvidence {
  label: string
  value: string
  unit?: string
  enteredBy?: string
  enteredAt?: string
  isInternal: boolean
}

export interface PrintableSourceProcedureEvidence {
  id: string
  name: string
  status: string
  completedAt?: string
  fields: PrintableSourceFieldEvidence[]
  signatures: PrintableSourceSignatureEvidence[]
}

export interface PrintableSourcePacketEvidence {
  studyHeader: {
    studyId: string
    protocolId: string
  }
  subjectIdentifier: string
  visitInfo: {
    visitName: string
    visitDate?: string
    status: string
  }
  sourcePackage: {
    id: string
    name: string
    versionUsedLogic: string
  }
  procedures: PrintableSourceProcedureEvidence[]
  attachments: PrintableSourceAttachmentEvidence[]
  auditReferences: PrintableSourceAuditReference[]
  warnings: string[]
}

// Consent Evidence Package Specific Types
export interface ConsentAuditReference {
  eventId: string
  action: string
  timestamp: string
  actorId?: string
  actorName?: string
}

export interface ConsentDocumentEvidence {
  id: string
  versionName: string
  consentType: string
  irbApprovalDate?: string
  effectiveDate: string
  expirationDate?: string
  status: string
}

export interface ConsentSignatureEvidence {
  signer: string
  role: string
  meaning: string
  method: string
  signedAt: string
  hash?: string
}

export interface ConsentTimelineItem {
  id: string
  type: 'original' | 'amendment' | 'reconsent' | 'withdrawal'
  date: string
  status: string
  documentVersionId?: string
  versionName?: string
}

export interface ConsentAttachmentEvidence {
  id: string
  filename: string
  uploadedAt: string
  uploadedBy?: string
  isCurrent: boolean
}

export interface ConsentEvidencePackageEvidence {
  studyHeader: {
    studyId: string
    protocolId: string
  }
  subjectIdentifier: string
  statusSummary: {
    currentStatus: string
    requiresReconsent: boolean
  }
  timeline: ConsentTimelineItem[]
  documents: ConsentDocumentEvidence[]
  signatures: ConsentSignatureEvidence[]
  attachments: ConsentAttachmentEvidence[]
  auditReferences: ConsentAuditReference[]
  warnings: string[]
}

// CRA Monitoring Workbook Specific Types
export interface CRAMonitoringSubjectIndexItem {
  subjectIdentifier: string
  subjectStatus: string
  enrollmentDate?: string
  screeningStatus?: string
  randomizationStatus?: string
  currentConsentStatus: string
  currentConsentVersion?: string
  latestVisitStatus: string
  notes?: string
}

export interface CRAMonitoringVisitIndexItem {
  subjectIdentifier: string
  visitName: string
  visitDate?: string
  visitStatus: string
  sourceVersionUsed?: string
  sourcePackageId?: string
  proceduresCompletedCount: number
  proceduresExpectedCount: number
  signatureStatus: string
  sourcePacketAvailable: boolean
  sourcePacketOutputId?: string
}

export interface CRAMonitoringProcedureMatrixItem {
  subjectIdentifier: string
  visitName: string
  visitDate?: string
  procedureName: string
  procedureStatus: string
  performedDate?: string
  performedBy?: string
  sourceVersionUsed?: string
  signatureStatus: string
}

export interface CRAMonitoringConsentSummaryItem {
  subjectIdentifier: string
  currentConsentStatus: string
  consentVersion?: string
  irbApprovalDate?: string
  siteImplementationDate?: string
  subjectSignedDate?: string
  staffSignedDate?: string
  reconsentRequired: boolean
  withdrawn: boolean
}

export interface CRAMonitoringSignatureSummaryItem {
  subjectIdentifier: string
  visitName?: string
  procedureName?: string
  signatureType: string
  signatureMeaning: string
  signerRole: string
  signedAt: string
  artifactHash?: string
  status: string
}

export interface CRAMonitoringDocumentLineageItem {
  subjectIdentifier: string
  visitName?: string
  procedureName?: string
  documentType: string
  currentVersion?: string
  versionUsed?: string
  sourcePackageVersion?: string
  effectiveDate?: string
  executionDate?: string
  uploadedAt: string
  uploadedBy?: string
  status: string
  priorVersionsCount: number
}

export interface CRAMonitoringWorkbookEvidence {
  workbookName: string
  studyName: string
  protocolNumber?: string
  site: string
  generatedAt: string
  generatedBy: string
  asOfDate: string
  audience: string
  scopeSummary: string
  subjectCount: number
  visitCount: number
  versionLogic: string
  deliverableRunId: string
  outputHash?: string
  subjects: CRAMonitoringSubjectIndexItem[]
  visits: CRAMonitoringVisitIndexItem[]
  procedures: CRAMonitoringProcedureMatrixItem[]
  consents: CRAMonitoringConsentSummaryItem[]
  signatures: CRAMonitoringSignatureSummaryItem[]
  documents: CRAMonitoringDocumentLineageItem[]
}
