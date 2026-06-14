/**
 * Regulatory Intelligence — core types.
 * Covers IRB approvals, investigator credentials, and subject consent risk.
 */

export type IRBApprovalRow = {
  id: string
  studyId: string
  organizationId: string
  approvalType: 'initial' | 'continuing_review' | 'amendment' | 'safety_report' | 'deviation_report'
  approvalNumber: string | null
  approvedDate: string
  expirationDate: string | null
  submissionDate: string | null
  nextRenewalDueDate: string | null
  status: 'active' | 'expired' | 'pending_renewal' | 'superseded'
  notes: string | null
}

export type InvestigatorCredentialRow = {
  id: string
  userId: string
  organizationId: string
  credentialType:
    | 'cv'
    | 'medical_license'
    | 'gcp_certificate'
    | 'iata_certificate'
    | 'protocol_training'
    | 'financial_disclosure_1572'
    | 'fdf'
    | 'other'
  studyId: string | null
  issueDate: string | null
  expirationDate: string | null
  credentialNumber: string | null
  status: 'current' | 'expiring_soon' | 'expired' | 'pending' | 'waived'
}

export type RegulatoryRisk = 'critical' | 'warning' | 'ok'

export type DocumentReadinessStatus = 'present' | 'expiring_soon' | 'expired' | 'missing'

export type DocumentReadinessItem = {
  category:
    | 'irb_approval'
    | 'gcp_certificate'
    | 'medical_license'
    | 'cv'
    | 'form_1572'
    | 'protocol_training'
  label: string
  status: DocumentReadinessStatus
  detail: string | null
}

export type DocumentReadiness = {
  items: DocumentReadinessItem[]
  overallStatus: 'ready' | 'gaps' | 'critical_gaps'
}

export type DelegationComplianceAlert = {
  staffUserId: string
  delegationLogId: string
  credentialType: string
  credentialStatus: string
  detail: string
}

export type StudyRegulatorySnapshot = {
  studyId: string
  irbStatus: RegulatoryRisk
  activeIRBApprovals: IRBApprovalRow[]
  expiringIRBApprovals: IRBApprovalRow[]
  staffCredentialRisk: RegulatoryRisk
  expiringCredentials: InvestigatorCredentialRow[]
  expiredCredentials: InvestigatorCredentialRow[]
  subjectConsentRisk: RegulatoryRisk
  subjectsNeedingReconsent: number
  documentReadiness: DocumentReadiness
  delegationAlerts: DelegationComplianceAlert[]
  overallRisk: RegulatoryRisk
}
