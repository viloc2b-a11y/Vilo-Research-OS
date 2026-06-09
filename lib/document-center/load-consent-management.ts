import { createServerClient } from '@/lib/supabase/server'
import { validateConsentRecord, type ConsentRecordValidationResult } from '@/lib/subject/consent/validate-consent-record'

type RelationRow = Record<string, unknown>

function relation<T extends RelationRow>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null
  if (value && typeof value === 'object') return value as T
  return null
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function boolOrFalse(value: unknown): boolean {
  return value === true
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

export type ConsentManagementLibraryRow = {
  id: string
  consentType: string
  versionNumber: number
  versionLabel: string | null
  language: string
  status: string
  reviewStatus: string
  effectiveDate: string
  expirationDate: string | null
  reconsentRequired: boolean
  requiresPiReview: boolean
  allowedSigningMethods: string[]
  requiredSignatures: string[]
}

export type ConsentManagementSubjectRow = {
  id: string
  subjectId: string
  subjectIdentifier: string
  consentType: string
  consentVersionLabel: string
  consentVersionNumber: number | null
  consentLanguage: string
  completionMethod: string | null
  consentStatus: string
  consentDateTime: string | null
  activeAt: string | null
  completedAt: string | null
  coordinatorSignedAt: string | null
  piSignedAt: string | null
  witnessSignedAt: string | null
  larSignedAt: string | null
  participantCopyProvided: boolean
  evidenceCount: number
  libraryStatus: string | null
  libraryReviewStatus: string | null
  reconsentStatus: string | null
  validation: ConsentRecordValidationResult
}

export type ConsentManagementEvidenceRow = {
  id: string
  subjectId: string
  subjectIdentifier: string
  consentType: string
  fileName: string
  documentKind: string
  source: string | null
  linkedAt: string
}

export type ConsentManagementReconsentRow = {
  id: string
  subjectId: string
  subjectIdentifier: string
  currentVersionLabel: string | null
  nextVersionLabel: string | null
  reason: string
  dueDate: string | null
  status: string
}

export type ConsentManagementSessionRow = {
  id: string
  subjectId: string
  subjectIdentifier: string
  consentVersionLabel: string | null
  tokenHint: string
  language: string
  status: string
  expiresAt: string
  lastViewedAt: string | null
}

export type ConsentManagementOverview = {
  study: {
    id: string
    organizationId: string
    name: string
  }
  dashboard: {
    libraryVersions: number
    activeLibraryVersions: number
    subjectRecords: number
    completeRecords: number
    pendingRecords: number
    actionNeededRecords: number
    reconsentQueue: number
    overdueReconsent: number
    evidenceUploads: number
    activeSessions: number
  }
  libraryVersions: ConsentManagementLibraryRow[]
  subjectRecords: ConsentManagementSubjectRow[]
  evidenceUploads: ConsentManagementEvidenceRow[]
  reconsentQueue: ConsentManagementReconsentRow[]
  patientSessions: ConsentManagementSessionRow[]
}

function subjectIdentifierFrom(row: RelationRow): string {
  const relationRow = relation<{ subject_identifier?: unknown }>(row.study_subjects)
  return String(relationRow?.subject_identifier ?? row.subject_identifier ?? row.subjectId ?? row.study_subject_id ?? '—')
}

function extractConsentLibraryRow(row: RelationRow): ConsentManagementLibraryRow {
  const metadata = metadataObject(row.metadata)
  return {
    id: String(row.id),
    consentType: String(row.consent_type ?? row.consentType ?? 'unknown'),
    versionNumber: Number(row.version_number ?? row.versionNumber ?? 0),
    versionLabel: stringOrNull(row.version_label ?? row.versionLabel),
    language: String(row.language ?? 'en'),
    status: String(row.status ?? 'draft'),
    reviewStatus: String(row.review_status ?? row.reviewStatus ?? 'needs_review'),
    effectiveDate: String(row.effective_date ?? row.effectiveDate ?? ''),
    expirationDate: stringOrNull(row.expiration_date ?? row.expirationDate),
    reconsentRequired: boolOrFalse(row.reconsent_required ?? row.reconsentRequired ?? metadata.reconsent_required),
    requiresPiReview: boolOrFalse(row.requires_pi_review ?? row.requiresPiReview ?? metadata.requires_pi_review),
    allowedSigningMethods: stringArray(metadata.allowed_signing_methods ?? metadata.allowedSigningMethods),
    requiredSignatures: stringArray(metadata.required_signatures ?? metadata.requiredSignatures),
  }
}

function extractSubjectRow(row: RelationRow, evidenceCount = 0): ConsentManagementSubjectRow {
  const version = relation<RelationRow>(row.consent_document_versions)
  const coordinatorSignature = relation<RelationRow>(row.coordinator_signature)
  const piSignature = relation<RelationRow>(row.pi_signature)
  const patientSignature = relation<RelationRow>(row.patient_signature)
  const larSignature = relation<RelationRow>(row.lar_guardian_signature)
  const witnessSignature = relation<RelationRow>(row.witness_signature)
  const subjectIdentifier = subjectIdentifierFrom(row)
  const metadata = metadataObject(row.metadata)
  const validation = validateConsentRecord({
    libraryStatus: stringOrNull(version?.status),
    libraryReviewStatus: stringOrNull(version?.review_status),
    completionMethod: stringOrNull(row.completion_method),
    consentStatus: stringOrNull(row.status),
    consentDateTime: stringOrNull(row.completed_at ?? row.effective_at),
    subjectSignatureRequired: row.patient_signature_required !== false,
    coordinatorSignatureRequired: true,
    piSignatureRequired: boolOrFalse(row.requires_pi_review ?? row.requiresPiReview),
    witnessSignatureRequired: row.witness_signature_required === true,
    larSignatureRequired: Boolean(row.lar_guardian_signature_id),
    subjectSignedAt: stringOrNull(patientSignature?.signed_at ?? row.completed_at),
    coordinatorSignedAt: stringOrNull(coordinatorSignature?.status === 'signed' ? row.completed_at ?? row.active_at ?? row.created_at : null),
    piSignedAt: stringOrNull(piSignature?.status === 'signed' ? row.completed_at ?? row.active_at ?? row.created_at : null),
    witnessSignedAt: stringOrNull(witnessSignature?.signed_at),
    larSignedAt: stringOrNull(larSignature?.signed_at),
    participantCopyProvided: boolOrFalse(
      row.participant_copy_provided ?? metadata.participant_copy_provided,
    ),
    evidenceCount,
    consentDocumentUploadPending: boolOrFalse(row.consent_document_upload_pending),
    activeVersionUsed: stringOrNull(version?.status) === 'active',
    trainingValid: true,
    delegationValid: true,
    reconsentStatus: stringOrNull(row.reconsent_status),
    reconsentActionRequired: boolOrFalse(row.reconsent_action_required),
  })

  return {
    id: String(row.id),
    subjectId: String(row.study_subject_id ?? row.subjectId ?? ''),
    subjectIdentifier,
    consentType: String(row.consent_type ?? 'unknown'),
    consentVersionLabel: String(row.consent_version_label ?? 'Unknown'),
    consentVersionNumber: numberOrNull(version?.version_number ?? row.consent_version_number),
    consentLanguage: String(row.language ?? version?.language ?? 'en'),
    completionMethod: stringOrNull(row.completion_method),
    consentStatus: String(row.status ?? 'not_started'),
    consentDateTime: stringOrNull(row.completed_at ?? row.effective_at),
    activeAt: stringOrNull(row.active_at),
    completedAt: stringOrNull(row.completed_at),
    coordinatorSignedAt: stringOrNull(row.coordinator_signed_at),
    piSignedAt: stringOrNull(row.pi_signed_at),
    witnessSignedAt: stringOrNull(witnessSignature?.signed_at ?? row.witness_signed_at),
    larSignedAt: stringOrNull(larSignature?.signed_at ?? row.lar_signed_at),
    participantCopyProvided: boolOrFalse(
      row.participant_copy_provided ?? metadataObject(row.metadata).participant_copy_provided,
    ),
    evidenceCount,
    libraryStatus: stringOrNull(version?.status),
    libraryReviewStatus: stringOrNull(version?.review_status),
    reconsentStatus: stringOrNull(row.reconsent_status),
    validation,
  }
}

function extractEvidenceRow(row: RelationRow): ConsentManagementEvidenceRow {
  const version = relation<RelationRow>(row.subject_consent_versions)
  return {
    id: String(row.id),
    subjectId: String(row.study_subject_id ?? row.subjectId ?? ''),
    subjectIdentifier: subjectIdentifierFrom(row),
    consentType: String(version?.consent_type ?? row.consent_type ?? 'unknown'),
    fileName: String(row.file_name ?? row.fileName ?? 'Unknown file'),
    documentKind: String(row.document_kind ?? row.documentKind ?? 'evidence'),
    source: stringOrNull(row.source),
    linkedAt: String(row.linked_at ?? row.linkedAt ?? ''),
  }
}

function extractReconsentRow(row: RelationRow): ConsentManagementReconsentRow {
  const currentVersion = relation<RelationRow>(row.current_subject_consent_versions)
  const nextVersion = relation<RelationRow>(row.consent_document_versions)
  return {
    id: String(row.id),
    subjectId: String(row.study_subject_id ?? row.subjectId ?? ''),
    subjectIdentifier: subjectIdentifierFrom(row),
    currentVersionLabel: stringOrNull(currentVersion?.consent_version_label),
    nextVersionLabel: stringOrNull(nextVersion?.version_label),
    reason: String(row.reason ?? 'Reconsent required'),
    dueDate: stringOrNull(row.reconsent_due_date),
    status: String(row.reconsent_status ?? 'pending'),
  }
}

function extractSessionRow(row: RelationRow): ConsentManagementSessionRow {
  const version = relation<RelationRow>(row.consent_document_versions)
  return {
    id: String(row.id),
    subjectId: String(row.study_subject_id ?? row.subjectId ?? ''),
    subjectIdentifier: subjectIdentifierFrom(row),
    consentVersionLabel: stringOrNull(version?.version_label),
    tokenHint: String(row.token_hint ?? ''),
    language: String(row.language ?? 'en'),
    status: String(row.status ?? 'active'),
    expiresAt: String(row.expires_at ?? row.expiresAt ?? ''),
    lastViewedAt: stringOrNull(row.last_viewed_at),
  }
}

export async function loadConsentManagementOverview(
  studyId: string,
  organizationId: string,
): Promise<ConsentManagementOverview | null> {
  const supabase = await createServerClient()

  const [
    studyResult,
    libraryResult,
    subjectResult,
    evidenceResult,
    reconsentResult,
    sessionResult,
  ] = await Promise.all([
    supabase.from('studies').select('id, organization_id, name').eq('id', studyId).eq('organization_id', organizationId).maybeSingle(),
    supabase
      .from('consent_document_versions')
      .select('id, study_id, consent_type, version_number, version_label, language, status, review_status, effective_date, expiration_date, reconsent_required, requires_pi_review, metadata, created_at, updated_at')
      .eq('study_id', studyId)
      .order('consent_type', { ascending: true })
      .order('version_number', { ascending: false }),
    supabase
      .from('subject_consent_versions')
      .select('*, coordinator_signature:coordinator_signature_request_id(status), pi_signature:pi_signature_request_id(status), patient_signature:patient_signature_id(signed_at, signer_type, signature_method), lar_guardian_signature:lar_guardian_signature_id(signed_at, signer_type, signature_method), witness_signature:witness_signature_id(signed_at, signer_type, signature_method), study_subjects(subject_identifier), consent_document_versions(version_number, status, review_status, language)')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('subject_consent_documents')
      .select('id, study_id, study_subject_id, consent_version_id, document_kind, file_name, source, linked_at, study_subjects(subject_identifier), subject_consent_versions(consent_type)')
      .eq('study_id', studyId)
      .order('linked_at', { ascending: false }),
    supabase
      .from('subject_consent_reconsent_requirements')
      .select('id, study_id, study_subject_id, consent_document_version_id, current_subject_consent_version_id, consent_action_required, reconsent_due_date, reconsent_status, reason, study_subjects(subject_identifier), consent_document_versions(version_label), current_subject_consent_versions(consent_version_label)')
      .eq('study_id', studyId)
      .in('reconsent_status', ['pending', 'overdue'])
      .order('reconsent_due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('subject_consent_patient_sessions')
      .select('id, study_id, study_subject_id, consent_document_version_id, subject_consent_version_id, token_hint, language, status, expires_at, last_viewed_at, study_subjects(subject_identifier), consent_document_versions(version_label)')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false }),
  ])

  if (studyResult.error || !studyResult.data) return null

  const libraryVersions = ((libraryResult.data ?? []) as RelationRow[]).map(extractConsentLibraryRow)
  const rawSubjectRows = (subjectResult.data ?? []) as RelationRow[]
  const evidenceUploads = ((evidenceResult.data ?? []) as RelationRow[]).map(extractEvidenceRow)
  const reconsentQueue = ((reconsentResult.data ?? []) as RelationRow[]).map(extractReconsentRow)
  const patientSessions = ((sessionResult.data ?? []) as RelationRow[]).map(extractSessionRow)

  const evidenceCounts = new Map<string, number>()
  for (const row of evidenceUploads) {
    const key = `${row.subjectId}:${row.consentType}`
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1)
  }

  const hydratedSubjectRecords = rawSubjectRows.map((row) => {
    const evidenceCount = evidenceCounts.get(`${String(row.study_subject_id ?? row.subjectId ?? '')}:${String(row.consent_type ?? 'unknown')}`) ?? 0
    return extractSubjectRow(row, evidenceCount)
  })

  const dashboard = {
    libraryVersions: libraryVersions.length,
    activeLibraryVersions: libraryVersions.filter((row) => row.status === 'active').length,
    subjectRecords: hydratedSubjectRecords.length,
    completeRecords: hydratedSubjectRecords.filter((row) => row.validation.is_complete).length,
    pendingRecords: hydratedSubjectRecords.filter((row) => ['pending', 'pending_signature', 'incomplete'].includes(row.consentStatus)).length,
    actionNeededRecords: hydratedSubjectRecords.filter((row) => !row.validation.is_complete).length,
    reconsentQueue: reconsentQueue.length,
    overdueReconsent: reconsentQueue.filter((row) => row.status === 'overdue').length,
    evidenceUploads: evidenceUploads.length,
    activeSessions: patientSessions.filter((row) => !['revoked', 'expired', 'signed'].includes(row.status)).length,
  }

  return {
    study: {
      id: String(studyResult.data.id),
      organizationId: String(studyResult.data.organization_id),
      name: String(studyResult.data.name),
    },
    dashboard,
    libraryVersions,
    subjectRecords: hydratedSubjectRecords,
    evidenceUploads,
    reconsentQueue,
    patientSessions,
  }
}
