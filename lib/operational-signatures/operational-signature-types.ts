export const OPERATIONAL_SIGNATURE_MEANINGS = [
  'completed_by',
  'reviewed_by',
  'approved_by',
  'acknowledged_by',
  'pi_review',
  'si_review',
  'query_closure',
  'lock_approval',
] as const

export type OperationalSignatureMeaning = (typeof OPERATIONAL_SIGNATURE_MEANINGS)[number]
export type SignaturePolicyCode =
  | 'standard_signature'
  | 'critical_signature'
  | 'subject_consent'
  | 'reconsent'
  | 'co_signature'

export const OPERATIONAL_SIGNATURE_WARNING =
  'I understand this electronic signature records my review/approval of this artifact and will be stored in the audit trail.'

export type OperationalSignatureRequestStatus =
  | 'pending'
  | 'signed'
  | 'expired'
  | 'cancelled'
  | 'voided'
  | 'superseded'
  | 'rejected'
  | 'rescinded'

export type OperationalSignatureStatus = 'signed' | 'superseded' | 'voided'

export type OperationalSignatureRequestRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string | null
  visitId: string | null
  sourcePackageId: string | null
  publishedSourceId: string | null
  lockedSnapshotId: string | null
  module: string | null
  entityType: string | null
  entityId: string | null
  artifactType: string
  artifactId: string
  requiredRole: string
  signatureMeaning: OperationalSignatureMeaning
  signaturePolicyCode: SignaturePolicyCode | string
  status: OperationalSignatureRequestStatus
  requestedBy: string | null
  requestedUserId: string | null
  requestedAt: string
  expiresAt: string | null
  metadata: Record<string, unknown>
}

export type OperationalSignatureRow = {
  id: string
  requestId: string
  organizationId: string
  studyId: string
  subjectId: string | null
  visitId: string | null
  sourcePackageId: string | null
  publishedSourceId: string | null
  lockedSnapshotId: string | null
  module: string | null
  entityType: string | null
  entityId: string | null
  artifactType: string
  artifactId: string
  requiredRole: string
  signerUserId: string
  signerNameSnapshot: string | null
  signerRoleSnapshot: string | null
  signerRole: string
  signatureMeaning: OperationalSignatureMeaning
  signaturePolicyCode: SignaturePolicyCode | string
  signedArtifactHash: string
  signedContentVersion: string | null
  verificationMethod: string | null
  signedAt: string
  ipAddress: string | null
  userAgent: string | null
  status: OperationalSignatureStatus
  supersedesSignatureId: string | null
  sessionId: string | null
  auditTrailId: string | null
  metadata: Record<string, unknown>
}

export type OperationalSignatureEventRow = {
  id: string
  organizationId: string
  studyId: string
  requestId: string | null
  signatureId: string | null
  eventType: string
  eventPayload: Record<string, unknown>
  actorUserId: string | null
  occurredAt: string
  metadata: Record<string, unknown>
}

export type CreateOperationalSignatureRequestInput = {
  organizationId: string
  studyId: string
  subjectId?: string | null
  visitId?: string | null
  sourcePackageId?: string | null
  publishedSourceId?: string | null
  lockedSnapshotId?: string | null
  module?: string | null
  entityType?: string | null
  entityId?: string | null
  artifactType: string
  artifactId: string
  requiredRole: string
  signatureMeaning: OperationalSignatureMeaning
  signaturePolicyCode?: SignaturePolicyCode
  requestedBy: string
  requestedUserId?: string | null
  metadata?: Record<string, unknown>
}

export type SignOperationalArtifactInput = {
  requestId: string
  signerUserId: string
  signerMemberships: import('@/lib/auth/session').OrganizationMembership[]
  explicitUserAction: boolean
  confirmationStatement: string
  signaturePin: string
  mfaVerified?: boolean
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

export function isOperationalSignatureMeaning(
  value: string,
): value is OperationalSignatureMeaning {
  return (OPERATIONAL_SIGNATURE_MEANINGS as readonly string[]).includes(value)
}

export function mapOperationalSignatureRequestRow(
  row: Record<string, unknown>,
): OperationalSignatureRequestRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: row.subject_id ? String(row.subject_id) : null,
    visitId: row.visit_id ? String(row.visit_id) : null,
    sourcePackageId: row.source_package_id ? String(row.source_package_id) : null,
    publishedSourceId: row.published_source_id ? String(row.published_source_id) : null,
    lockedSnapshotId: row.locked_snapshot_id ? String(row.locked_snapshot_id) : null,
    module: row.module ? String(row.module) : null,
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    artifactType: String(row.artifact_type),
    artifactId: String(row.artifact_id),
    requiredRole: String(row.required_role),
    signatureMeaning: row.signature_meaning as OperationalSignatureMeaning,
    signaturePolicyCode: String(row.signature_policy_code ?? 'standard_signature'),
    status: row.status as OperationalSignatureRequestStatus,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    requestedUserId: row.requested_user_id ? String(row.requested_user_id) : null,
    requestedAt: String(row.requested_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export function mapOperationalSignatureRow(row: Record<string, unknown>): OperationalSignatureRow {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: row.subject_id ? String(row.subject_id) : null,
    visitId: row.visit_id ? String(row.visit_id) : null,
    sourcePackageId: row.source_package_id ? String(row.source_package_id) : null,
    publishedSourceId: row.published_source_id ? String(row.published_source_id) : null,
    lockedSnapshotId: row.locked_snapshot_id ? String(row.locked_snapshot_id) : null,
    module: row.module ? String(row.module) : null,
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    artifactType: String(row.artifact_type),
    artifactId: String(row.artifact_id),
    requiredRole: String(row.required_role),
    signerUserId: String(row.signer_user_id),
    signerNameSnapshot: row.signer_name_snapshot ? String(row.signer_name_snapshot) : null,
    signerRoleSnapshot: row.signer_role_snapshot ? String(row.signer_role_snapshot) : null,
    signerRole: String(row.signer_role),
    signatureMeaning: row.signature_meaning as OperationalSignatureMeaning,
    signaturePolicyCode: String(row.signature_policy_code ?? 'standard_signature'),
    signedArtifactHash: String(row.signed_artifact_hash),
    signedContentVersion: row.signed_content_version ? String(row.signed_content_version) : null,
    verificationMethod: row.verification_method ? String(row.verification_method) : null,
    signedAt: String(row.signed_at),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    status: row.status as OperationalSignatureStatus,
    supersedesSignatureId: row.supersedes_signature_id
      ? String(row.supersedes_signature_id)
      : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    auditTrailId: row.audit_trail_id ? String(row.audit_trail_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export function mapOperationalSignatureEventRow(
  row: Record<string, unknown>,
): OperationalSignatureEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    requestId: row.request_id ? String(row.request_id) : null,
    signatureId: row.signature_id ? String(row.signature_id) : null,
    eventType: String(row.event_type),
    eventPayload: (row.event_payload as Record<string, unknown>) ?? {},
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    occurredAt: String(row.occurred_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
