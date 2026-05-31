'use server'

import { revalidatePath } from 'next/cache'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures'
import type { OperationalSignatureMeaning } from '@/lib/operational-signatures'
import { getSessionUser } from '@/lib/auth/session'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import type {
  ConsentStatus,
  ConsentType,
  MasterConsentDocumentVersionRow,
  OptionalPermissionStatus,
  OptionalPermissionType,
  PatientConsentPortalModel,
  ReconsentRequirementRow,
  SubjectConsentRuntimeModel,
} from './types'
import { createHash, randomBytes } from 'node:crypto'

type SubjectContext = {
  subjectId: string
  studyId: string
  organizationId: string
  legacyConsentSignedAt: string | null
  legacyConsentVersionId: string | null
  legacyPrivacyConsent: boolean
}

type CreateConsentVersionInput = {
  consentType: ConsentType
  consentDocumentVersionId?: string
  consentVersionLabel: string
  protocolVersion?: string
  amendmentIdentifier?: string
  language?: string
  effectiveAt?: string
  expiresAt?: string
  requiresPiReview?: boolean
  supersedesConsentVersionId?: string
  reason?: string
}

type CreateMasterConsentVersionInput = {
  consentType: string
  versionNumber: number
  versionLabel?: string
  irbApprovalDate?: string
  effectiveDate: string
  expirationDate?: string
  reconsentRequired?: boolean
  requiredByDate?: string
  amendmentIdentifier?: string
  status?: 'draft' | 'review_needed' | 'irb_approved' | 'active' | 'superseded' | 'retired'
  documentReaderArtifactId?: string
  documentId?: string
  protocolVersionId?: string
  language?: 'en' | 'es'
  optionalClauseChanged?: boolean
}

type DocumentReaderConsentInput = {
  documentReaderArtifactId: string
  consentType?: string
  versionNumber?: number
  irbApprovalDate?: string
  effectiveDate?: string
  reconsentRequired?: boolean
  requiredByDate?: string
  amendmentIdentifier?: string
  extractionConfidence?: number
  clauses?: {
    clauseType: string
    clauseStatus?: string
    extractedText?: string
    extractionConfidence?: number
    requiresOptionalPermission?: boolean
    requiresReconsentOnChange?: boolean
  }[]
}

type PatientSessionInput = {
  subjectId: string
  consentDocumentVersionId?: string
  subjectConsentVersionId?: string
  language?: 'en' | 'es'
  expiresInHours?: number
}

type PatientConsentSignatureInput = {
  accessToken: string
  signerType: 'patient' | 'lar_guardian' | 'witness'
  signerName: string
  attestationText: string
  signatureMethod?: 'typed_attestation' | 'drawn_signature' | 'checkbox_attestation'
  userAgent?: string
  ipAddress?: string
}

type PatientConsentViewInput = {
  accessToken: string
  userAgent?: string
  ipAddress?: string
}

type PaperConsentAttestationInput = {
  consentVersionId?: string
  consentDocumentVersionId?: string
  consentType?: ConsentType
  consentVersionLabel?: string
  consentDateTime: string
  requiresPiReview?: boolean
  uploadLater?: boolean
  reason?: string
}

type ImportedLegacyConsentInput = {
  consentDocumentVersionId?: string
  consentType?: ConsentType
  consentVersionLabel: string
  consentDateTime: string
  reason: string
}

type ConsentDocumentReviewInput = {
  versionNumber?: number
  versionLabel?: string
  irbApprovalDate?: string
  effectiveDate?: string
  expirationDate?: string
  amendmentIdentifier?: string
  reconsentRequired?: boolean
  requiredByDate?: string
  optionalClauseChanged?: boolean
  reason?: string
}

type CreateConsentEventInput = {
  consentVersionId?: string
  eventType: string
  eventStatus?: ConsentStatus
  eventAt?: string
  reason?: string
}

type LinkConsentDocumentInput = {
  consentVersionId?: string
  consentEventId?: string
  documentKind: string
  fileName: string
  filePath?: string
  externalDocumentId?: string
  mimeType?: string
  documentHash?: string
}

type RequestConsentSignatureInput = {
  targetType: 'version' | 'withdrawal' | 'event' | 'optional_permission'
  targetId: string
  signer: 'coordinator' | 'pi' | 'withdrawal_acknowledger' | 'subject_acknowledgment'
}

type CompleteConsentSignatureInput = RequestConsentSignatureInput

type WithdrawConsentInput = {
  consentVersionId?: string
  withdrawalScope: string
  reason: string
}

type OptionalPermissionInput = {
  consentVersionId?: string
  permissionType: OptionalPermissionType
  permissionStatus: OptionalPermissionStatus
  reason: string
}

type ReasonInput = {
  consentVersionId: string
  reason: string
}

const VERSION_SELECT = `
  *,
  coordinator_signature:coordinator_signature_request_id(status),
  pi_signature:pi_signature_request_id(status)
`

export async function loadSubjectConsentRuntime(
  subjectId: string,
): Promise<SubjectConsentRuntimeModel> {
  const supabase = await createServerClient()
  const context = await loadSubjectContext(subjectId)

  const [
    versionsResult,
    eventsResult,
    documentsResult,
    permissionsResult,
    withdrawalsResult,
    masterVersionsResult,
    clausesResult,
    reconsentResult,
    patientSessionsResult,
    patientSignaturesResult,
  ] = await Promise.all([
      supabase
        .from('subject_consent_versions')
        .select(VERSION_SELECT)
        .eq('study_subject_id', subjectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_consent_events')
        .select('*, signature:signature_request_id(status)')
        .eq('study_subject_id', subjectId)
        .order('event_at', { ascending: false })
        .limit(100),
      supabase
        .from('subject_consent_documents')
        .select('*')
        .eq('study_subject_id', subjectId)
        .order('linked_at', { ascending: false }),
      supabase
        .from('subject_consent_optional_permissions')
        .select('*, signature:signature_request_id(status)')
        .eq('study_subject_id', subjectId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('subject_consent_withdrawals')
        .select('*, acknowledgment_signature:acknowledgment_signature_request_id(status)')
        .eq('study_subject_id', subjectId)
        .order('withdrawn_at', { ascending: false }),
      supabase
        .from('consent_document_versions')
        .select('*')
        .eq('study_id', context.studyId)
        .order('consent_type', { ascending: true })
        .order('version_number', { ascending: false }),
      supabase
        .from('consent_document_clauses')
        .select('*')
        .eq('study_id', context.studyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_consent_reconsent_requirements')
        .select('*, study_subjects(subject_identifier)')
        .eq('study_subject_id', subjectId)
        .order('detected_at', { ascending: false }),
      supabase
        .from('subject_consent_patient_sessions')
        .select('*')
        .eq('study_subject_id', subjectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_consent_patient_signatures')
        .select('*')
        .eq('study_subject_id', subjectId)
        .order('signed_at', { ascending: false }),
    ])

  const versions = ((versionsResult.data ?? []) as Record<string, unknown>[]).map(mapVersionRow)
  const activeConsent =
    versions.find(
      (version) =>
        version.status === 'active' &&
        ['initial_consent', 're_consent', 'amendment_consent'].includes(version.consentType),
    ) ?? null
  const activeHipaa =
    versions.find(
      (version) => version.status === 'active' && version.consentType === 'hipaa_authorization',
    ) ?? null

  return {
    subjectId,
    studyId: context.studyId,
    organizationId: context.organizationId,
    legacyConsentSignedAt: context.legacyConsentSignedAt,
    legacyConsentVersionId: context.legacyConsentVersionId,
    legacyPrivacyConsent: context.legacyPrivacyConsent,
    currentStatus: activeConsent?.status ?? (versions[0]?.status ?? 'not_started'),
    activeConsent,
    activeHipaa,
    hasWithdrawal: Boolean(withdrawalsResult.data?.length),
    versions,
    events: ((eventsResult.data ?? []) as Record<string, unknown>[]).map(mapEventRow),
    documents: ((documentsResult.data ?? []) as Record<string, unknown>[]).map(mapDocumentRow),
    optionalPermissions: ((permissionsResult.data ?? []) as Record<string, unknown>[]).map(
      mapPermissionRow,
    ),
    withdrawals: ((withdrawalsResult.data ?? []) as Record<string, unknown>[]).map(
      mapWithdrawalRow,
    ),
    masterVersions: ((masterVersionsResult.data ?? []) as Record<string, unknown>[]).map(
      mapMasterConsentVersionRow,
    ),
    clauses: ((clausesResult.data ?? []) as Record<string, unknown>[]).map(mapClauseRow),
    reconsentRequirements: ((reconsentResult.data ?? []) as Record<string, unknown>[]).map(
      mapReconsentRequirementRow,
    ),
    patientSessions: ((patientSessionsResult.data ?? []) as Record<string, unknown>[]).map(
      mapPatientSessionRow,
    ),
    patientSignatures: ((patientSignaturesResult.data ?? []) as Record<string, unknown>[]).map(
      mapPatientSignatureRow,
    ),
  }
}

export async function createMasterConsentVersionAction(
  studyId: string,
  input: CreateMasterConsentVersionInput,
) {
  const sessionUser = await requireSessionUser()
  const supabase = await createServerClient()
  const orgId = await getOrganizationForStudy(studyId)
  if (!input.effectiveDate) throw new Error('Effective date is required.')
  if (!input.versionNumber || input.versionNumber < 1) throw new Error('Version number is required.')

  if (input.status === 'active') {
    await retirePriorActiveMasterVersion(studyId, input.consentType)
  }

  const { data, error } = await supabase
    .from('consent_document_versions')
    .insert({
      organization_id: orgId,
      study_id: studyId,
      protocol_version_id: input.protocolVersionId || null,
      document_reader_artifact_id: input.documentReaderArtifactId || null,
      document_id: input.documentId || null,
      consent_type: input.consentType,
      version_number: input.versionNumber,
      version_label: clean(input.versionLabel),
      irb_approval_date: clean(input.irbApprovalDate),
      effective_date: input.effectiveDate,
      expiration_date: clean(input.expirationDate),
      reconsent_required: Boolean(input.reconsentRequired),
      required_by_date: clean(input.requiredByDate),
      amendment_identifier: clean(input.amendmentIdentifier),
      status: input.status ?? 'draft',
      optional_clause_changed: Boolean(input.optionalClauseChanged),
      language: input.language ?? 'en',
      review_status: 'not_required',
      created_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create master consent version.')

  if (input.status === 'active' && input.reconsentRequired) {
    await detectReconsentRequirementsForStudy(studyId)
  }
  revalidatePath(`/studies/${studyId}`)
  return { ok: true, consentDocumentVersionId: String(data.id) }
}

export async function createConsentVersionFromDocumentReaderAction(
  studyId: string,
  input: DocumentReaderConsentInput,
) {
  const sessionUser = await requireSessionUser()
  const supabase = await createServerClient()
  const orgId = await getOrganizationForStudy(studyId)
  const { data: doc, error } = await supabase
    .from('document_intelligence_documents')
    .select('id, compliance_document_id, document_classification, version_number, version_label, effective_date, language, classification_metadata')
    .eq('id', input.documentReaderArtifactId)
    .eq('study_id', studyId)
    .single()
  if (error || !doc) throw new Error(error?.message ?? 'Document Reader artifact not found.')

  const confidence = input.extractionConfidence ?? Number((doc.classification_metadata as Record<string, unknown> | null)?.confidence ?? 0.75)
  const needsReview = confidence < 0.8
  const consentType =
    input.consentType ?? inferConsentType(String(doc.document_classification), String(doc.version_label ?? ''))
  const effectiveDate = input.effectiveDate ?? (doc.effective_date ? String(doc.effective_date) : new Date().toISOString().slice(0, 10))

  const { data: version, error: versionError } = await supabase
    .from('consent_document_versions')
    .insert({
      organization_id: orgId,
      study_id: studyId,
      document_reader_artifact_id: input.documentReaderArtifactId,
      document_id: doc.compliance_document_id,
      consent_type: consentType,
      version_number: input.versionNumber ?? Number(doc.version_number ?? 1),
      version_label: doc.version_label ? String(doc.version_label) : null,
      irb_approval_date: clean(input.irbApprovalDate),
      effective_date: effectiveDate,
      reconsent_required: Boolean(input.reconsentRequired),
      required_by_date: clean(input.requiredByDate),
      amendment_identifier: clean(input.amendmentIdentifier),
      status: needsReview ? 'review_needed' : 'irb_approved',
      review_status: needsReview ? 'needs_review' : 'not_required',
      extraction_confidence: confidence,
      language: doc.language ? String(doc.language) : 'en',
      metadata: { document_reader_mapping: true },
      created_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (versionError || !version) {
    throw new Error(versionError?.message ?? 'Failed to map Document Reader output.')
  }

  const clauses: DocumentReaderConsentInput['clauses'] = input.clauses?.length
    ? input.clauses
    : inferClausesFromConsentType(consentType, confidence)
  if (clauses.length) {
    const { error: clauseError } = await supabase.from('consent_document_clauses').insert(
      clauses.map((clause) => ({
        organization_id: orgId,
        study_id: studyId,
        consent_document_version_id: version.id,
        clause_type: clause.clauseType,
        clause_status: clause.clauseStatus ?? (needsReview ? 'needs_review' : 'present'),
        extracted_text: clean(clause.extractedText),
        extraction_confidence: clause.extractionConfidence ?? confidence,
        requires_optional_permission: Boolean(clause.requiresOptionalPermission),
        requires_reconsent_on_change: Boolean(clause.requiresReconsentOnChange),
      })),
    )
    if (clauseError) throw new Error(clauseError.message)
  }
  return { ok: true, consentDocumentVersionId: String(version.id), reviewNeeded: needsReview }
}

export async function activateMasterConsentVersionAction(consentDocumentVersionId: string) {
  const supabase = await createServerClient()
  const { data: version, error } = await supabase
    .from('consent_document_versions')
    .select('study_id, consent_type, reconsent_required')
    .eq('id', consentDocumentVersionId)
    .single()
  if (error || !version) throw new Error(error?.message ?? 'Master consent version not found.')
  await retirePriorActiveMasterVersion(String(version.study_id), String(version.consent_type))
  const { error: updateError } = await supabase
    .from('consent_document_versions')
    .update({ status: 'active', review_status: 'reviewed' })
    .eq('id', consentDocumentVersionId)
  if (updateError) throw new Error(updateError.message)
  if (version.reconsent_required) {
    await detectReconsentRequirementsForStudy(String(version.study_id))
  }
  return { ok: true }
}

export async function updateConsentDocumentVersionReviewAction(
  consentDocumentVersionId: string,
  input: ConsentDocumentReviewInput,
) {
  const sessionUser = await requireSessionUser()
  const supabase = await createServerClient()
  const { data: existing, error: loadError } = await supabase
    .from('consent_document_versions')
    .select('*')
    .eq('id', consentDocumentVersionId)
    .single()
  if (loadError || !existing) throw new Error(loadError?.message ?? 'Consent document version not found.')

  const { error } = await supabase
    .from('consent_document_versions')
    .update({
      ...(input.versionNumber ? { version_number: input.versionNumber } : {}),
      ...(input.versionLabel !== undefined ? { version_label: clean(input.versionLabel) } : {}),
      ...(input.irbApprovalDate !== undefined ? { irb_approval_date: clean(input.irbApprovalDate) } : {}),
      ...(input.effectiveDate !== undefined ? { effective_date: input.effectiveDate } : {}),
      ...(input.expirationDate !== undefined ? { expiration_date: clean(input.expirationDate) } : {}),
      ...(input.amendmentIdentifier !== undefined ? { amendment_identifier: clean(input.amendmentIdentifier) } : {}),
      ...(input.reconsentRequired !== undefined ? { reconsent_required: input.reconsentRequired } : {}),
      ...(input.requiredByDate !== undefined ? { required_by_date: clean(input.requiredByDate) } : {}),
      ...(input.optionalClauseChanged !== undefined ? { optional_clause_changed: input.optionalClauseChanged } : {}),
      metadata: {
        ...metadataObject(existing.metadata),
        review_edited_by: sessionUser.id,
        review_edited_at: new Date().toISOString(),
        review_reason: clean(input.reason),
      },
    })
    .eq('id', consentDocumentVersionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/studies/${existing.study_id}`)
  return { ok: true }
}

export async function approveConsentDocumentVersionReviewAction(
  consentDocumentVersionId: string,
  reason?: string,
) {
  const sessionUser = await requireSessionUser()
  const supabase = await createServerClient()
  const { data: version, error } = await supabase
    .from('consent_document_versions')
    .select('study_id, consent_type, metadata')
    .eq('id', consentDocumentVersionId)
    .single()
  if (error || !version) throw new Error(error?.message ?? 'Consent document version not found.')

  await retirePriorActiveMasterVersion(String(version.study_id), String(version.consent_type))
  const { error: updateError } = await supabase
    .from('consent_document_versions')
    .update({
      status: 'active',
      review_status: 'reviewed',
      metadata: {
        ...metadataObject(version.metadata),
        approved_by: sessionUser.id,
        approved_at: new Date().toISOString(),
        approval_reason: clean(reason),
      },
    })
    .eq('id', consentDocumentVersionId)
  if (updateError) throw new Error(updateError.message)
  await detectReconsentRequirementsForStudy(String(version.study_id))
  revalidatePath(`/studies/${version.study_id}`)
  return { ok: true }
}

export async function rejectConsentDocumentVersionReviewAction(
  consentDocumentVersionId: string,
  reason: string,
) {
  const sessionUser = await requireSessionUser()
  if (!reason.trim()) throw new Error('Reason is required to reject consent extraction.')
  const supabase = await createServerClient()
  const { data: version, error: loadError } = await supabase
    .from('consent_document_versions')
    .select('study_id, metadata')
    .eq('id', consentDocumentVersionId)
    .single()
  if (loadError || !version) throw new Error(loadError?.message ?? 'Consent document version not found.')
  const { error } = await supabase
    .from('consent_document_versions')
    .update({
      status: 'retired',
      review_status: 'reviewed',
      metadata: {
        ...metadataObject(version.metadata),
        rejected_by: sessionUser.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
      },
    })
    .eq('id', consentDocumentVersionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/studies/${version.study_id}`)
  return { ok: true }
}

export async function detectReconsentRequirementsForStudy(studyId: string) {
  const supabase = await createServerClient()
  const orgId = await getOrganizationForStudy(studyId)
  const { data: requiredVersions, error: requiredError } = await supabase
    .from('consent_document_versions')
    .select('*')
    .eq('study_id', studyId)
    .eq('status', 'active')
    .or('reconsent_required.eq.true,optional_clause_changed.eq.true')
  if (requiredError) throw new Error(requiredError.message)

  const { data: subjects, error: subjectsError } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('study_id', studyId)
    .eq('organization_id', orgId)
  if (subjectsError) throw new Error(subjectsError.message)

  let createdOrUpdated = 0
  for (const required of (requiredVersions ?? []) as Record<string, unknown>[]) {
    for (const subject of (subjects ?? []) as Record<string, unknown>[]) {
      const subjectId = String(subject.id)
      const current = await loadCurrentSubjectConsentForMaster(supabase, subjectId, String(required.consent_type))
      if (current && current.consent_document_version_id === required.id && current.status === 'active') {
        await markReconsentCompleted(subjectId, String(required.id), String(current.id))
        continue
      }
      const signedVersionNumber = current?.master_version_number ?? 0
      const requiredVersionNumber = Number(required.version_number ?? 0)
      if (!current || signedVersionNumber < requiredVersionNumber || required.optional_clause_changed) {
        const due = required.required_by_date ? String(required.required_by_date) : null
        const status = due && new Date(due).getTime() < Date.now() ? 'overdue' : 'pending'
        const { error } = await supabase
          .from('subject_consent_reconsent_requirements')
          .upsert(
            {
              organization_id: orgId,
              study_id: studyId,
              study_subject_id: subjectId,
              consent_document_version_id: required.id,
              current_subject_consent_version_id: current?.id ?? null,
              consent_outdated: true,
              reconsent_required: true,
              consent_action_required: true,
              pending_consent_version_id: required.id,
              reconsent_due_date: due,
              reconsent_status: status,
              reason: buildReconsentReason(required, current),
            },
            { onConflict: 'study_subject_id,consent_document_version_id' },
          )
        if (error) throw new Error(error.message)
        createdOrUpdated += 1
      }
    }
  }
  return { ok: true, requirements: createdOrUpdated }
}

export async function listReconsentQueue(studyId: string) {
  const supabase = await createServerClient()
  await supabase
    .from('subject_consent_reconsent_requirements')
    .update({ reconsent_status: 'overdue' })
    .eq('study_id', studyId)
    .eq('reconsent_status', 'pending')
    .lt('reconsent_due_date', new Date().toISOString().slice(0, 10))
  const { data, error } = await supabase
    .from('subject_consent_reconsent_requirements')
    .select('*, study_subjects(subject_identifier)')
    .eq('study_id', studyId)
    .in('reconsent_status', ['pending', 'overdue'])
    .order('reconsent_due_date', { ascending: true, nullsFirst: false })
    .order('detected_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapReconsentRequirementRow)
}

export async function createPatientConsentSessionAction(input: PatientSessionInput) {
  const sessionUser = await requireSessionUser()
  const context = await loadSubjectContext(input.subjectId)
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000).toISOString()
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_patient_sessions')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: input.subjectId,
      consent_document_version_id: input.consentDocumentVersionId || null,
      subject_consent_version_id: input.subjectConsentVersionId || null,
      token_hash: tokenHash,
      token_hint: token.slice(0, 6),
      language: input.language ?? 'en',
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
      created_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create patient eConsent session.')
  await appendConsentAudit({
    context,
    action: 'patient_econsent_session_created',
    consentVersionId: input.subjectConsentVersionId ?? null,
    actorUserId: sessionUser.id,
    eventPayload: {
      patient_session_id: data.id,
      consent_document_version_id: input.consentDocumentVersionId ?? null,
      expires_at: expiresAt,
    },
  })
  return { ok: true, patientSessionId: String(data.id), accessToken: token, expiresAt }
}

export async function revokePatientConsentSessionAction(patientSessionId: string, reason: string) {
  const sessionUser = await requireSessionUser()
  if (!reason.trim()) throw new Error('Reason is required to revoke a patient consent session.')
  const supabase = await createServerClient()
  const { data: row, error: loadError } = await supabase
    .from('subject_consent_patient_sessions')
    .select('*')
    .eq('id', patientSessionId)
    .single()
  if (loadError || !row) throw new Error(loadError?.message ?? 'Patient session not found.')
  const { error } = await supabase
    .from('subject_consent_patient_sessions')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), metadata: { reason } })
    .eq('id', patientSessionId)
  if (error) throw new Error(error.message)
  await appendConsentAudit({
    context: contextFromRow(row as Record<string, unknown>),
    action: 'patient_econsent_session_revoked',
    reason,
    consentVersionId: stringOrNull(row.subject_consent_version_id),
    actorUserId: sessionUser.id,
    eventPayload: { patient_session_id: patientSessionId },
  })
  return { ok: true }
}

export async function viewPatientConsentSessionAction(input: PatientConsentViewInput) {
  const token = input.accessToken.trim()
  if (!token) throw new Error('Patient consent access token is required.')
  const service = await createServiceClient()
  const { data: session, error } = await service
    .from('subject_consent_patient_sessions')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!session) throw new Error('Patient consent session not found.')
  if (!['active', 'viewed'].includes(String(session.status))) {
    throw new Error('Patient consent session is not active.')
  }
  if (new Date(String(session.expires_at)).getTime() < Date.now()) {
    await service
      .from('subject_consent_patient_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
    throw new Error('Patient consent session has expired.')
  }

  const now = new Date().toISOString()
  await service
    .from('subject_consent_patient_sessions')
    .update({ status: 'viewed', last_viewed_at: now })
    .eq('id', session.id)
  await appendConsentAuditWithClient(service, {
    context: contextFromRow(session as Record<string, unknown>),
    action: 'patient_econsent_session_viewed',
    consentVersionId: stringOrNull(session.subject_consent_version_id),
    actorUserId: null,
    eventPayload: {
      patient_session_id: session.id,
      viewed_at: now,
      user_agent: clean(input.userAgent),
      ip_address: clean(input.ipAddress),
      consent_only_scope: true,
    },
  })
  return {
    ok: true,
    patientSessionId: String(session.id),
    subjectConsentVersionId: stringOrNull(session.subject_consent_version_id),
    consentDocumentVersionId: stringOrNull(session.consent_document_version_id),
    language: session.language === 'es' ? 'es' : 'en',
    expiresAt: String(session.expires_at),
  }
}

export async function loadPatientConsentPortalAction(accessToken: string): Promise<PatientConsentPortalModel> {
  const token = accessToken.trim()
  if (!token) throw new Error('Patient consent access token is required.')
  const service = await createServiceClient()
  const { data: session, error } = await service
    .from('subject_consent_patient_sessions')
    .select('*, study_subjects(subject_identifier), subject_consent_versions(consent_version_label, consent_type), consent_document_versions(version_label, version_number, consent_type, status)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!session) throw new Error('Patient consent session not found.')
  if (!['active', 'viewed', 'signed'].includes(String(session.status))) {
    throw new Error('Patient consent session is not active.')
  }
  if (new Date(String(session.expires_at)).getTime() < Date.now()) {
    await service
      .from('subject_consent_patient_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
    throw new Error('Patient consent session has expired.')
  }

  if (session.status === 'active') {
    await service
      .from('subject_consent_patient_sessions')
      .update({ status: 'viewed', last_viewed_at: new Date().toISOString() })
      .eq('id', session.id)
    await appendConsentAuditWithClient(service, {
      context: contextFromRow(session as Record<string, unknown>),
      action: 'patient_econsent_session_viewed',
      consentVersionId: stringOrNull(session.subject_consent_version_id),
      actorUserId: null,
      eventPayload: {
        patient_session_id: session.id,
        consent_only_scope: true,
        portal_load: true,
      },
    })
  }

  const documentVersionId = stringOrNull(session.consent_document_version_id)
  const { data: clauses } = documentVersionId
    ? await service
        .from('consent_document_clauses')
        .select('*')
        .eq('consent_document_version_id', documentVersionId)
        .order('created_at', { ascending: true })
    : { data: [] }
  const { data: signatures } = await service
    .from('subject_consent_patient_signatures')
    .select('*')
    .eq('patient_session_id', session.id)
    .order('signed_at', { ascending: true })

  const subject = relation(session.study_subjects)
  const version = relation(session.subject_consent_versions)
  const master = relation(session.consent_document_versions)

  return {
    tokenHint: String(session.token_hint),
    language: session.language === 'es' ? 'es' : 'en',
    status: String(session.status === 'active' ? 'viewed' : session.status),
    expiresAt: String(session.expires_at),
    subjectIdentifier: stringOrNull(subject?.subject_identifier),
    consentVersionLabel: stringOrNull(version?.consent_version_label),
    consentType: stringOrNull(version?.consent_type) ?? stringOrNull(master?.consent_type),
    masterVersionLabel: stringOrNull(master?.version_label),
    masterVersionNumber: master?.version_number ? Number(master.version_number) : null,
    documentStatus: stringOrNull(master?.status),
    clauses: ((clauses ?? []) as Record<string, unknown>[]).map(mapClauseRow),
    existingSignatures: ((signatures ?? []) as Record<string, unknown>[]).map(mapPatientSignatureRow),
  }
}

export async function recordPatientConsentSignatureAction(input: PatientConsentSignatureInput) {
  const token = input.accessToken.trim()
  if (!token) throw new Error('Patient consent access token is required.')
  if (!input.signerName.trim()) throw new Error('Signer name is required.')
  if (!input.attestationText.trim()) throw new Error('Attestation text is required.')

  const service = await createServiceClient()
  const tokenHash = hashToken(token)
  const { data: session, error: sessionError } = await service
    .from('subject_consent_patient_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error('Patient consent session not found.')
  if (!['active', 'viewed'].includes(String(session.status))) {
    throw new Error('Patient consent session is not active.')
  }
  if (new Date(String(session.expires_at)).getTime() < Date.now()) {
    await service
      .from('subject_consent_patient_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
    throw new Error('Patient consent session has expired.')
  }

  const context = contextFromRow(session as Record<string, unknown>)
  const consentVersionId = stringOrNull(session.subject_consent_version_id)
  const { data: event, error: eventError } = await service
    .from('subject_consent_events')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: context.subjectId,
      consent_version_id: consentVersionId,
      consent_document_version_id: stringOrNull(session.consent_document_version_id),
      patient_session_id: session.id,
      event_type: 'signature_completed',
      event_status: 'completed',
      actor_user_id: null,
      metadata: {
        completion_method: 'electronic_patient_signature',
        signer_type: input.signerType,
        patient_session_id: session.id,
        consent_only_scope: true,
      },
    })
    .select('id')
    .single()
  if (eventError || !event) throw new Error(eventError?.message ?? 'Failed to create patient signature event.')

  const { data: signature, error: signatureError } = await service
    .from('subject_consent_patient_signatures')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: context.subjectId,
      patient_session_id: session.id,
      subject_consent_version_id: consentVersionId,
      consent_event_id: event.id,
      signer_type: input.signerType,
      signer_name: input.signerName.trim(),
      signature_method: input.signatureMethod ?? 'typed_attestation',
      attestation_text: input.attestationText.trim(),
      ip_address: clean(input.ipAddress),
      user_agent: clean(input.userAgent),
      metadata: { consent_only_scope: true },
    })
    .select('id')
    .single()
  if (signatureError || !signature) {
    throw new Error(signatureError?.message ?? 'Failed to record patient consent signature.')
  }

  await service
    .from('subject_consent_patient_sessions')
    .update({ status: 'signed', last_viewed_at: new Date().toISOString() })
    .eq('id', session.id)

  if (consentVersionId) {
    const signatureColumn =
      input.signerType === 'lar_guardian'
        ? 'lar_guardian_signature_id'
        : input.signerType === 'witness'
          ? 'witness_signature_id'
          : 'patient_signature_id'
    const { data: version } = await service
      .from('subject_consent_versions')
      .select('metadata')
      .eq('id', consentVersionId)
      .maybeSingle()
    await service
      .from('subject_consent_versions')
      .update({
        [signatureColumn]: signature.id,
        metadata: {
          ...metadataObject(version?.metadata),
          completion_method: 'electronic_patient_signature',
          patient_signature_completed_at: new Date().toISOString(),
        },
      })
      .eq('id', consentVersionId)
  }

  await appendConsentAuditWithClient(service, {
    context,
    action: 'patient_econsent_signature_recorded',
    newStatus: 'completed',
    consentVersionId,
    consentEventId: String(event.id),
    actorUserId: null,
    eventPayload: {
      patient_session_id: session.id,
      patient_signature_id: signature.id,
      signer_type: input.signerType,
      completion_method: 'electronic_patient_signature',
    },
  })

  return { ok: true, patientSignatureId: String(signature.id), consentEventId: String(event.id) }
}

export async function createConsentVersionAction(
  subjectId: string,
  input: CreateConsentVersionInput,
) {
  const sessionUser = await requireSessionUser()
  const context = await loadSubjectContext(subjectId)
  if (!input.consentVersionLabel.trim()) throw new Error('Consent version label is required.')
  if (
    ['amendment_consent', 're_consent'].includes(input.consentType) &&
    !input.reason?.trim()
  ) {
    throw new Error('Reason is required for amendment and re-consent.')
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_versions')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: subjectId,
      consent_document_version_id: input.consentDocumentVersionId || null,
      consent_type: input.consentType,
      consent_version_label: input.consentVersionLabel.trim(),
      protocol_version: clean(input.protocolVersion),
      amendment_identifier: clean(input.amendmentIdentifier),
      language: clean(input.language) ?? 'en',
      effective_at: clean(input.effectiveAt),
      expires_at: clean(input.expiresAt),
      supersedes_consent_version_id: input.supersedesConsentVersionId || null,
      requires_pi_review: Boolean(input.requiresPiReview),
      reason: clean(input.reason),
      created_by: sessionUser.id,
      metadata: { workflow: 'subject_consent_runtime' },
    })
    .select('id, status')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create consent version.')

  const event = await insertConsentEvent({
    context,
    consentVersionId: String(data.id),
    eventType: consentTypeToEventType(input.consentType),
    eventStatus: 'pending',
    reason: clean(input.reason),
    actorUserId: sessionUser.id,
  })
  await appendConsentAudit({
    context,
    action: 'consent_version_created',
    newStatus: 'pending',
    reason: clean(input.reason),
    consentVersionId: String(data.id),
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })

  revalidateSubject(subjectId)
  return { ok: true, consentVersionId: String(data.id) }
}

export async function attestPaperConsentAction(
  subjectId: string,
  input: PaperConsentAttestationInput,
) {
  const sessionUser = await requireSessionUser()
  const context = await loadSubjectContext(subjectId)
  const consentDate = parseConsentDate(input.consentDateTime)
  const uploadPending = input.uploadLater !== false
  const supabase = await createServerClient()
  const attestationText =
    'I attest that the subject/LAR signed the correct paper consent version before any study procedure, and that the signed document will be uploaded or linked to the subject record.'

  let consentVersionId = input.consentVersionId ?? null
  let previousStatus: string | null = null
  if (!consentVersionId) {
    const { data, error } = await supabase
      .from('subject_consent_versions')
      .insert({
        organization_id: context.organizationId,
        study_id: context.studyId,
        study_subject_id: subjectId,
        consent_document_version_id: input.consentDocumentVersionId || null,
        consent_type: input.consentType ?? 'initial_consent',
        consent_version_label: input.consentVersionLabel?.trim() || 'Paper consent attestation',
        status: 'pending',
        effective_at: consentDate,
        requires_pi_review: Boolean(input.requiresPiReview),
        reason: clean(input.reason),
        created_by: sessionUser.id,
        metadata: {
          workflow: 'subject_consent_runtime',
          completion_method: 'paper_signed_attested',
          paper_consent_signed_at: consentDate,
          consent_document_upload_pending: uploadPending,
          coordinator_attestation_text: attestationText,
        },
      })
      .select('id, status')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create paper consent attestation.')
    consentVersionId = String(data.id)
    previousStatus = String(data.status)
  } else {
    const { data: version, error: loadError } = await supabase
      .from('subject_consent_versions')
      .select('status, metadata')
      .eq('id', consentVersionId)
      .eq('study_subject_id', subjectId)
      .single()
    if (loadError || !version) throw new Error(loadError?.message ?? 'Consent version not found.')
    previousStatus = String(version.status)
    const { error } = await supabase
      .from('subject_consent_versions')
      .update({
        effective_at: consentDate,
        requires_pi_review: Boolean(input.requiresPiReview),
        reason: clean(input.reason),
        metadata: {
          ...metadataObject(version.metadata),
          workflow: 'subject_consent_runtime',
          completion_method: 'paper_signed_attested',
          paper_consent_signed_at: consentDate,
          consent_document_upload_pending: uploadPending,
          coordinator_attestation_text: attestationText,
        },
      })
      .eq('id', consentVersionId)
    if (error) throw new Error(error.message)
  }

  const event = await insertConsentEvent({
    context,
    consentVersionId,
    eventType: consentTypeToEventType(input.consentType ?? 'initial_consent'),
    eventStatus: 'pending',
    eventAt: consentDate,
    reason: clean(input.reason) ?? 'Paper consent signed; coordinator attestation pending.',
    actorUserId: sessionUser.id,
    metadata: {
      completion_method: 'paper_signed_attested',
      consent_document_upload_pending: uploadPending,
      coordinator_attestation_text: attestationText,
    },
  })

  await appendConsentAudit({
    context,
    action: 'paper_consent_attestation_recorded',
    previousStatus,
    newStatus: 'pending',
    reason: clean(input.reason),
    consentVersionId,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
    eventPayload: {
      completion_method: 'paper_signed_attested',
      paper_consent_signed_at: consentDate,
      consent_document_upload_pending: uploadPending,
      coordinator_attestation_text: attestationText,
    },
  })

  const signature = await requestConsentSignatureAction({
    targetType: 'version',
    targetId: consentVersionId,
    signer: 'coordinator',
  })
  revalidateSubject(subjectId)
  return {
    ok: true,
    consentVersionId,
    requestId: signature.requestId,
    consentDocumentUploadPending: uploadPending,
  }
}

export async function importLegacyConsentAction(
  subjectId: string,
  input: ImportedLegacyConsentInput,
) {
  const sessionUser = await requireSessionUser()
  if (!input.reason.trim()) throw new Error('Reason is required for imported legacy consent.')
  const context = await loadSubjectContext(subjectId)
  const consentDate = parseConsentDate(input.consentDateTime)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_consent_versions')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: subjectId,
      consent_document_version_id: input.consentDocumentVersionId || null,
      consent_type: input.consentType ?? 'initial_consent',
      consent_version_label: input.consentVersionLabel.trim(),
      status: 'active',
      effective_at: consentDate,
      completed_at: consentDate,
      active_at: consentDate,
      locked_at: new Date().toISOString(),
      locked_by: sessionUser.id,
      reason: input.reason.trim(),
      created_by: sessionUser.id,
      metadata: {
        workflow: 'subject_consent_runtime',
        completion_method: 'imported_legacy',
        imported_legacy_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to import legacy consent.')

  const event = await insertConsentEvent({
    context,
    consentVersionId: String(data.id),
    eventType: consentTypeToEventType(input.consentType ?? 'initial_consent'),
    eventStatus: 'active',
    eventAt: consentDate,
    reason: input.reason.trim(),
    actorUserId: sessionUser.id,
    metadata: { completion_method: 'imported_legacy' },
  })
  await appendConsentAudit({
    context,
    action: 'legacy_consent_imported',
    newStatus: 'active',
    reason: input.reason.trim(),
    consentVersionId: String(data.id),
    consentEventId: event.id,
    actorUserId: sessionUser.id,
    eventPayload: { completion_method: 'imported_legacy', imported_legacy_at: new Date().toISOString() },
  })

  if (['initial_consent', 're_consent', 'amendment_consent'].includes(input.consentType ?? 'initial_consent')) {
    await syncLegacyConsent(context, String(data.id), consentDate)
  }
  if (input.consentType === 'hipaa_authorization') await syncLegacyPrivacyConsent(context, true)
  await clearCompletedReconsentForVersion(context, String(data.id), input.consentDocumentVersionId ?? null)
  revalidateSubject(subjectId)
  return { ok: true, consentVersionId: String(data.id) }
}

export async function createConsentEventAction(subjectId: string, input: CreateConsentEventInput) {
  const sessionUser = await requireSessionUser()
  const context = await loadSubjectContext(subjectId)
  if (['withdrawal', 'supersession', 'invalidation'].includes(input.eventType) && !input.reason) {
    throw new Error('Reason is required for withdrawal, supersession, or invalidation events.')
  }
  const event = await insertConsentEvent({
    context,
    consentVersionId: input.consentVersionId ?? null,
    eventType: input.eventType,
    eventStatus: input.eventStatus ?? 'pending',
    eventAt: input.eventAt,
    reason: clean(input.reason),
    actorUserId: sessionUser.id,
  })
  await appendConsentAudit({
    context,
    action: 'consent_event_created',
    newStatus: input.eventStatus ?? 'pending',
    reason: clean(input.reason),
    consentVersionId: input.consentVersionId ?? null,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(subjectId)
  return { ok: true, consentEventId: event.id }
}

export async function uploadLinkConsentDocumentAction(
  subjectId: string,
  input: LinkConsentDocumentInput,
) {
  const sessionUser = await requireSessionUser()
  const context = await loadSubjectContext(subjectId)
  if (!input.fileName.trim()) throw new Error('File name is required.')
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_documents')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: subjectId,
      consent_version_id: input.consentVersionId || null,
      consent_event_id: input.consentEventId || null,
      document_kind: input.documentKind,
      file_name: input.fileName.trim(),
      file_path: clean(input.filePath),
      external_document_id: clean(input.externalDocumentId),
      mime_type: clean(input.mimeType),
      document_hash: clean(input.documentHash),
      linked_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to link consent document.')

  await insertConsentEvent({
    context,
    consentVersionId: input.consentVersionId ?? null,
    eventType: 'document_linked',
    eventStatus: 'completed',
    actorUserId: sessionUser.id,
    metadata: { document_id: data.id, file_name: input.fileName },
  })
  await appendConsentAudit({
    context,
    action: 'consent_document_linked',
    consentVersionId: input.consentVersionId ?? null,
    documentId: String(data.id),
    actorUserId: sessionUser.id,
  })
  if (input.consentVersionId) {
    await clearConsentDocumentUploadPending(
      supabase,
      input.consentVersionId,
      context,
      String(data.id),
      sessionUser.id,
    )
  }
  revalidateSubject(subjectId)
  return { ok: true, documentId: String(data.id) }
}

export async function requestConsentSignatureAction(input: RequestConsentSignatureInput) {
  const sessionUser = await requireSessionUser()
  const artifact = await loadSignatureTarget(input)
  const existingRequestId = requestIdForTarget(artifact.row, input)
  if (existingRequestId) return { ok: true, requestId: existingRequestId }

  const supabase = await createServerClient()
  const config = signatureConfig(input.signer)
  const request = await createOperationalSignatureRequest(supabase, {
    organizationId: artifact.context.organizationId,
    studyId: artifact.context.studyId,
    subjectId: artifact.context.subjectId,
    artifactType: artifact.artifactType,
    artifactId: input.targetId,
    requiredRole: config.requiredRole,
    signatureMeaning: config.meaning,
    requestedBy: sessionUser.id,
    metadata: {
      workflow: 'subject_consent_runtime',
      target_type: input.targetType,
      signer: input.signer,
    },
  })

  await patchSignatureTarget(input, request.id)
  const event = await insertConsentEvent({
    context: artifact.context,
    consentVersionId: consentVersionIdForTarget(artifact.row),
    eventType: 'signature_requested',
    eventStatus: 'pending',
    signatureRequestId: request.id,
    actorUserId: sessionUser.id,
    metadata: { signer: input.signer, target_type: input.targetType },
  })
  await appendConsentAudit({
    context: artifact.context,
    action: 'consent_signature_requested',
    newStatus: statusForTargetAfterRequest(input),
    consentVersionId: consentVersionIdForTarget(artifact.row),
    consentEventId: event.id,
    signatureRequestId: request.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(artifact.context.subjectId)
  return { ok: true, requestId: request.id }
}

export async function completeConsentSignatureAction(input: CompleteConsentSignatureInput) {
  const sessionUser = await requireSessionUser()
  const artifact = await loadSignatureTarget(input)
  const requestId = requestIdForTarget(artifact.row, input)
  if (!requestId) throw new Error('Consent signature request has not been created.')
  const supabase = await createServerClient()
  const { data: request, error } = await supabase
    .from('operational_signature_requests')
    .select('status')
    .eq('id', requestId)
    .single()
  if (error || !request) throw new Error(error?.message ?? 'Signature request not found.')
  if (request.status !== 'signed') throw new Error('Signature request is not signed yet.')

  const status = await completeTargetAfterSignature(input)
  const event = await insertConsentEvent({
    context: artifact.context,
    consentVersionId: consentVersionIdForTarget(artifact.row),
    eventType: 'signature_completed',
    eventStatus: status,
    signatureRequestId: requestId,
    actorUserId: sessionUser.id,
    metadata: { signer: input.signer, target_type: input.targetType },
  })
  await appendConsentAudit({
    context: artifact.context,
    action: 'consent_signature_completed',
    previousStatus: String(artifact.row.status ?? artifact.row.event_status ?? 'pending'),
    newStatus: status,
    consentVersionId: consentVersionIdForTarget(artifact.row),
    consentEventId: event.id,
    signatureRequestId: requestId,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(artifact.context.subjectId)
  return { ok: true, status }
}

export async function supersedeConsentAction(input: ReasonInput) {
  const sessionUser = await requireSessionUser()
  if (!input.reason.trim()) throw new Error('Reason is required to supersede consent.')
  const target = await loadConsentVersionTarget(input.consentVersionId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('subject_consent_versions')
    .update({ status: 'superseded', reason: input.reason.trim() })
    .eq('id', input.consentVersionId)
  if (error) throw new Error(error.message)
  const event = await insertConsentEvent({
    context: target.context,
    consentVersionId: input.consentVersionId,
    eventType: 'supersession',
    eventStatus: 'superseded',
    reason: input.reason,
    actorUserId: sessionUser.id,
  })
  await appendConsentAudit({
    context: target.context,
    action: 'consent_superseded',
    previousStatus: String(target.row.status),
    newStatus: 'superseded',
    reason: input.reason,
    consentVersionId: input.consentVersionId,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(target.context.subjectId)
  return { ok: true }
}

export async function withdrawConsentAction(subjectId: string, input: WithdrawConsentInput) {
  const sessionUser = await requireSessionUser()
  if (!input.reason.trim()) throw new Error('Reason is required to withdraw consent.')
  const context = await loadSubjectContext(subjectId)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_withdrawals')
    .insert({
      organization_id: context.organizationId,
      study_id: context.studyId,
      study_subject_id: subjectId,
      consent_version_id: input.consentVersionId || null,
      withdrawal_scope: input.withdrawalScope,
      reason: input.reason.trim(),
      created_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to record withdrawal.')

  if (input.consentVersionId) {
    await supabase
      .from('subject_consent_versions')
      .update({ status: 'withdrawn', reason: input.reason.trim() })
      .eq('id', input.consentVersionId)
  }

  const event = await insertConsentEvent({
    context,
    consentVersionId: input.consentVersionId ?? null,
    eventType: 'withdrawal',
    eventStatus: 'withdrawn',
    reason: input.reason,
    actorUserId: sessionUser.id,
    metadata: { withdrawal_id: data.id, scope: input.withdrawalScope },
  })
  await appendConsentAudit({
    context,
    action: 'consent_withdrawn',
    newStatus: 'withdrawn',
    reason: input.reason,
    consentVersionId: input.consentVersionId ?? null,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(subjectId)
  return { ok: true, withdrawalId: String(data.id) }
}

export async function updateOptionalConsentPermissionAction(
  subjectId: string,
  input: OptionalPermissionInput,
) {
  const sessionUser = await requireSessionUser()
  if (!input.reason.trim()) throw new Error('Reason is required for optional consent changes.')
  const context = await loadSubjectContext(subjectId)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_optional_permissions')
    .upsert(
      {
        organization_id: context.organizationId,
        study_id: context.studyId,
        study_subject_id: subjectId,
        consent_version_id: input.consentVersionId || null,
        permission_type: input.permissionType,
        permission_status: input.permissionStatus,
        effective_at: new Date().toISOString(),
        changed_reason: input.reason.trim(),
        updated_by: sessionUser.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'study_subject_id,permission_type' },
    )
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to update optional permission.')

  const event = await insertConsentEvent({
    context,
    consentVersionId: input.consentVersionId ?? null,
    eventType: 'optional_permission_update',
    eventStatus: 'completed',
    reason: input.reason,
    actorUserId: sessionUser.id,
    metadata: { permission_type: input.permissionType, permission_status: input.permissionStatus },
  })
  await appendConsentAudit({
    context,
    action: 'optional_consent_permission_updated',
    newStatus: 'completed',
    reason: input.reason,
    consentVersionId: input.consentVersionId ?? null,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(subjectId)
  return { ok: true, permissionId: String(data.id) }
}

export async function invalidateConsentAction(input: ReasonInput) {
  const sessionUser = await requireSessionUser()
  if (!input.reason.trim()) throw new Error('Reason is required to invalidate consent.')
  const target = await loadConsentVersionTarget(input.consentVersionId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('subject_consent_versions')
    .update({ status: 'invalidated', reason: input.reason.trim() })
    .eq('id', input.consentVersionId)
  if (error) throw new Error(error.message)
  const event = await insertConsentEvent({
    context: target.context,
    consentVersionId: input.consentVersionId,
    eventType: 'invalidation',
    eventStatus: 'invalidated',
    reason: input.reason,
    actorUserId: sessionUser.id,
  })
  await appendConsentAudit({
    context: target.context,
    action: 'consent_invalidated',
    previousStatus: String(target.row.status),
    newStatus: 'invalidated',
    reason: input.reason,
    consentVersionId: input.consentVersionId,
    consentEventId: event.id,
    actorUserId: sessionUser.id,
  })
  revalidateSubject(target.context.subjectId)
  return { ok: true }
}

async function completeTargetAfterSignature(input: CompleteConsentSignatureInput): Promise<ConsentStatus> {
  if (input.targetType === 'version') return completeConsentVersionAfterSignature(input.targetId)
  if (input.targetType === 'withdrawal') return completeWithdrawalAfterSignature(input.targetId)
  if (input.targetType === 'optional_permission') return 'completed'
  return 'completed'
}

async function completeConsentVersionAfterSignature(consentVersionId: string): Promise<ConsentStatus> {
  const target = await loadConsentVersionTarget(consentVersionId)
  const coordinatorSigned = await isRequestSigned(
    stringOrNull(target.row.coordinator_signature_request_id),
  )
  const piSigned =
    !target.row.requires_pi_review ||
    await isRequestSigned(stringOrNull(target.row.pi_signature_request_id))
  const completed = Boolean(coordinatorSigned && piSigned)
  if (completed && !hasConsentCompletionEvidence(target.row)) {
    throw new Error(
      'Consent cannot be completed without patient/LAR signature, paper consent attestation, or imported legacy evidence.',
    )
  }
  const nextStatus: ConsentStatus = completed
    ? target.row.consent_type === 'optional_consent'
      ? 'completed'
      : 'active'
    : 'pending'

  if (!completed) return nextStatus

  const supabase = await createServerClient()
  const now = new Date().toISOString()
  if (
    ['initial_consent', 're_consent', 'amendment_consent'].includes(String(target.row.consent_type))
  ) {
    await supabase
      .from('subject_consent_versions')
      .update({ status: 'superseded', superseded_by_consent_version_id: consentVersionId })
      .eq('study_subject_id', target.context.subjectId)
      .eq('study_id', target.context.studyId)
      .in('consent_type', ['initial_consent', 're_consent', 'amendment_consent'])
      .eq('status', 'active')
      .neq('id', consentVersionId)
  }

  const { error } = await supabase
    .from('subject_consent_versions')
    .update({
      status: nextStatus,
      completed_at: now,
      active_at: nextStatus === 'active' ? now : null,
      locked_at: now,
      locked_by: (await requireSessionUser()).id,
      metadata: {
        ...metadataObject(target.row.metadata),
        operational_signature_completed_at: now,
        ...(completionMethod(target.row) === 'paper_signed_attested'
          ? { paper_attestation_signed: true }
          : {}),
      },
    })
    .eq('id', consentVersionId)
  if (error) throw new Error(error.message)

  if (
    nextStatus === 'active' &&
    ['initial_consent', 're_consent', 'amendment_consent'].includes(String(target.row.consent_type))
  ) {
    await syncLegacyConsent(target.context, consentVersionId, now)
  }
  if (target.row.consent_type === 'hipaa_authorization') {
    await syncLegacyPrivacyConsent(target.context, true)
  }
  await clearCompletedReconsentForVersion(
    target.context,
    consentVersionId,
    stringOrNull(target.row.consent_document_version_id),
  )
  return nextStatus
}

async function completeWithdrawalAfterSignature(withdrawalId: string): Promise<ConsentStatus> {
  const target = await loadWithdrawalTarget(withdrawalId)
  const supabase = await createServerClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('subject_consent_withdrawals')
    .update({ acknowledged_at: now, locked_at: now, locked_by: (await requireSessionUser()).id })
    .eq('id', withdrawalId)
  if (error) throw new Error(error.message)
  if (target.row.consent_version_id) {
    await supabase
      .from('subject_consent_versions')
      .update({ status: 'withdrawn' })
      .eq('id', target.row.consent_version_id)
  }
  return 'withdrawn'
}

function hasConsentCompletionEvidence(row: Record<string, unknown>) {
  const method = completionMethod(row)
  if (method === 'paper_signed_attested' || method === 'imported_legacy') return true
  if (method === 'electronic_patient_signature') {
    return Boolean(
      stringOrNull(row.patient_signature_id) ||
      stringOrNull(row.lar_guardian_signature_id),
    )
  }
  if (row.patient_signature_required === false) return true
  return Boolean(stringOrNull(row.patient_signature_id) || stringOrNull(row.lar_guardian_signature_id))
}

function completionMethod(row: Record<string, unknown>) {
  const method = metadataObject(row.metadata).completion_method
  return typeof method === 'string' ? method : null
}

async function clearCompletedReconsentForVersion(
  context: SubjectContext,
  subjectConsentVersionId: string,
  consentDocumentVersionId: string | null,
) {
  if (!consentDocumentVersionId) return
  const supabase = await createServerClient()
  await supabase
    .from('subject_consent_reconsent_requirements')
    .update({
      reconsent_status: 'completed',
      consent_outdated: false,
      reconsent_required: false,
      consent_action_required: false,
      current_subject_consent_version_id: subjectConsentVersionId,
      completed_at: new Date().toISOString(),
    })
    .eq('study_subject_id', context.subjectId)
    .eq('consent_document_version_id', consentDocumentVersionId)
}

async function clearConsentDocumentUploadPending(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  consentVersionId: string,
  context: SubjectContext,
  documentId: string,
  actorUserId: string,
) {
  const { data: version } = await supabase
    .from('subject_consent_versions')
    .select('metadata')
    .eq('id', consentVersionId)
    .maybeSingle()
  const metadata = metadataObject(version?.metadata)
  if (metadata.consent_document_upload_pending !== true) return
  const { error } = await supabase
    .from('subject_consent_versions')
    .update({
      metadata: {
        ...metadata,
        consent_document_upload_pending: false,
        consent_document_linked_after_attestation_at: new Date().toISOString(),
        linked_document_id: documentId,
      },
    })
    .eq('id', consentVersionId)
  if (error) throw new Error(error.message)
  await appendConsentAudit({
    context,
    action: 'CONSENT_DOCUMENT_LINKED_AFTER_ATTESTATION',
    consentVersionId,
    documentId,
    actorUserId,
    eventPayload: {
      consent_document_upload_pending: false,
      linked_document_id: documentId,
    },
  })
}

async function loadSubjectContext(subjectId: string): Promise<SubjectContext> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, consent_signed_at, consent_version_id, privacy_consent')
    .eq('id', subjectId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Subject not found.')
  return {
    subjectId,
    organizationId: String(data.organization_id),
    studyId: String(data.study_id),
    legacyConsentSignedAt: data.consent_signed_at ? String(data.consent_signed_at) : null,
    legacyConsentVersionId: data.consent_version_id ? String(data.consent_version_id) : null,
    legacyPrivacyConsent: Boolean(data.privacy_consent),
  }
}

async function getOrganizationForStudy(studyId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Study not found.')
  return String(data.organization_id)
}

async function retirePriorActiveMasterVersion(studyId: string, consentType: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('consent_document_versions')
    .update({ status: 'superseded' })
    .eq('study_id', studyId)
    .eq('consent_type', consentType)
    .eq('status', 'active')
  if (error) throw new Error(error.message)
}

async function loadCurrentSubjectConsentForMaster(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  subjectId: string,
  masterConsentType: string,
) {
  const subjectTypes = subjectConsentTypesForMaster(masterConsentType)
  const { data } = await supabase
    .from('subject_consent_versions')
    .select('id, status, consent_document_version_id, consent_document_versions(version_number)')
    .eq('study_subject_id', subjectId)
    .in('consent_type', subjectTypes)
    .eq('status', 'active')
    .order('active_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const master = relation(data.consent_document_versions)
  return {
    id: String(data.id),
    status: String(data.status),
    consent_document_version_id: data.consent_document_version_id
      ? String(data.consent_document_version_id)
      : null,
    master_version_number: master?.version_number ? Number(master.version_number) : 0,
  }
}

async function markReconsentCompleted(
  subjectId: string,
  consentDocumentVersionId: string,
  subjectConsentVersionId: string,
) {
  const supabase = await createServerClient()
  await supabase
    .from('subject_consent_reconsent_requirements')
    .update({
      reconsent_status: 'completed',
      consent_outdated: false,
      reconsent_required: false,
      consent_action_required: false,
      current_subject_consent_version_id: subjectConsentVersionId,
      completed_at: new Date().toISOString(),
    })
    .eq('study_subject_id', subjectId)
    .eq('consent_document_version_id', consentDocumentVersionId)
}

function subjectConsentTypesForMaster(masterConsentType: string) {
  if (masterConsentType === 'main_icf') {
    return ['initial_consent', 're_consent', 'amendment_consent']
  }
  if (masterConsentType === 'hipaa_authorization') return ['hipaa_authorization']
  if (masterConsentType === 'genetic_testing') return ['genetic_consent']
  return ['optional_consent', 'future_use_consent']
}

function inferConsentType(documentClassification: string, label: string) {
  const text = `${documentClassification} ${label}`.toLowerCase()
  if (text.includes('hipaa')) return 'hipaa_authorization'
  if (text.includes('genetic')) return 'genetic_testing'
  if (text.includes('future')) return 'optional_future_use'
  if (text.includes('assent')) return 'assent'
  if (text.includes('biospecimen')) return 'biospecimen_storage'
  return 'main_icf'
}

function inferClausesFromConsentType(
  consentType: string,
  confidence: number,
): NonNullable<DocumentReaderConsentInput['clauses']> {
  const base = [
    { clauseType: 'withdrawal_language', requiresOptionalPermission: false, requiresReconsentOnChange: true },
  ]
  if (consentType === 'hipaa_authorization') {
    return [{ clauseType: 'hipaa_authorization', requiresOptionalPermission: false, requiresReconsentOnChange: true }, ...base]
  }
  if (consentType === 'genetic_testing') {
    return [{ clauseType: 'genetic_testing', requiresOptionalPermission: true, requiresReconsentOnChange: true }, ...base]
  }
  if (consentType === 'optional_future_use') {
    return [{ clauseType: 'future_research_use', requiresOptionalPermission: true, requiresReconsentOnChange: true }, ...base]
  }
  return [
    { clauseType: 'future_research_use', requiresOptionalPermission: true, requiresReconsentOnChange: false },
    { clauseType: 'data_sharing', requiresOptionalPermission: true, requiresReconsentOnChange: false },
    ...base,
  ].map((clause) => ({ ...clause, extractionConfidence: confidence }))
}

function buildReconsentReason(required: Record<string, unknown>, current: { master_version_number: number } | null) {
  if (!current) return `No active subject consent for required ${required.consent_type} v${required.version_number}.`
  if (required.optional_clause_changed) {
    return `Optional consent clauses changed in ${required.consent_type} v${required.version_number}.`
  }
  return `Subject signed v${current.master_version_number}; required active version is v${required.version_number}.`
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function loadSignatureTarget(input: RequestConsentSignatureInput) {
  if (input.targetType === 'version') return loadConsentVersionTarget(input.targetId)
  if (input.targetType === 'withdrawal') return loadWithdrawalTarget(input.targetId)
  if (input.targetType === 'optional_permission') return loadOptionalPermissionTarget(input.targetId)
  return loadConsentEventTarget(input.targetId)
}

async function loadConsentVersionTarget(consentVersionId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_versions')
    .select('*')
    .eq('id', consentVersionId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Consent version not found.')
  return {
    artifactType: 'subject_consent_version',
    row: data as Record<string, unknown>,
    context: contextFromRow(data as Record<string, unknown>),
  }
}

async function loadWithdrawalTarget(withdrawalId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_withdrawals')
    .select('*')
    .eq('id', withdrawalId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Consent withdrawal not found.')
  return {
    artifactType: 'subject_consent_withdrawal',
    row: data as Record<string, unknown>,
    context: contextFromRow(data as Record<string, unknown>),
  }
}

async function loadOptionalPermissionTarget(permissionId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_optional_permissions')
    .select('*')
    .eq('id', permissionId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Optional permission not found.')
  return {
    artifactType: 'subject_consent_optional_permission',
    row: data as Record<string, unknown>,
    context: contextFromRow(data as Record<string, unknown>),
  }
}

async function loadConsentEventTarget(eventId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_events')
    .select('*')
    .eq('id', eventId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Consent event not found.')
  return {
    artifactType: 'subject_consent_event',
    row: data as Record<string, unknown>,
    context: contextFromRow(data as Record<string, unknown>),
  }
}

async function patchSignatureTarget(input: RequestConsentSignatureInput, requestId: string) {
  const supabase = await createServerClient()
  if (input.targetType === 'version') {
    const column =
      input.signer === 'pi' ? 'pi_signature_request_id' : 'coordinator_signature_request_id'
    const { error } = await supabase
      .from('subject_consent_versions')
      .update({ [column]: requestId })
      .eq('id', input.targetId)
    if (error) throw new Error(error.message)
    return
  }
  if (input.targetType === 'withdrawal') {
    const { error } = await supabase
      .from('subject_consent_withdrawals')
      .update({ acknowledgment_signature_request_id: requestId })
      .eq('id', input.targetId)
    if (error) throw new Error(error.message)
    return
  }
  if (input.targetType === 'optional_permission') {
    const { error } = await supabase
      .from('subject_consent_optional_permissions')
      .update({ signature_request_id: requestId })
      .eq('id', input.targetId)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await supabase
    .from('subject_consent_events')
    .update({ signature_request_id: requestId })
    .eq('id', input.targetId)
  if (error) throw new Error(error.message)
}

function requestIdForTarget(row: Record<string, unknown>, input: RequestConsentSignatureInput) {
  if (input.targetType === 'version') {
    return input.signer === 'pi'
      ? stringOrNull(row.pi_signature_request_id)
      : stringOrNull(row.coordinator_signature_request_id)
  }
  if (input.targetType === 'withdrawal') return stringOrNull(row.acknowledgment_signature_request_id)
  return stringOrNull(row.signature_request_id)
}

function consentVersionIdForTarget(row: Record<string, unknown>) {
  return stringOrNull(row.consent_version_id) ?? stringOrNull(row.id)
}

function statusForTargetAfterRequest(input: RequestConsentSignatureInput) {
  if (input.targetType === 'withdrawal') return 'withdrawn'
  return 'pending'
}

function signatureConfig(signer: RequestConsentSignatureInput['signer']): {
  requiredRole: string
  meaning: OperationalSignatureMeaning
} {
  if (signer === 'pi') return { requiredRole: 'pi_sub_i', meaning: 'pi_review' }
  if (signer === 'withdrawal_acknowledger') {
    return { requiredRole: 'pi_sub_i', meaning: 'acknowledged_by' }
  }
  return { requiredRole: 'research_coordinator', meaning: 'completed_by' }
}

async function insertConsentEvent(input: {
  context: SubjectContext
  consentVersionId: string | null
  eventType: string
  eventStatus: ConsentStatus
  eventAt?: string
  reason?: string | null
  signatureRequestId?: string | null
  actorUserId: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_consent_events')
    .insert({
      organization_id: input.context.organizationId,
      study_id: input.context.studyId,
      study_subject_id: input.context.subjectId,
      consent_version_id: input.consentVersionId,
      event_type: input.eventType,
      event_status: input.eventStatus,
      event_at: input.eventAt ?? new Date().toISOString(),
      reason: input.reason ?? null,
      signature_request_id: input.signatureRequestId ?? null,
      actor_user_id: input.actorUserId,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create consent event.')
  return { id: String(data.id) }
}

async function appendConsentAudit(input: {
  context: SubjectContext
  action: string
  previousStatus?: string | null
  newStatus?: string | null
  reason?: string | null
  consentVersionId?: string | null
  consentEventId?: string | null
  documentId?: string | null
  signatureRequestId?: string | null
  actorUserId: string | null
  eventPayload?: Record<string, unknown>
}) {
  const supabase = await createServerClient()
  await appendConsentAuditWithClient(supabase, input)
}

async function appendConsentAuditWithClient(
  supabase: Awaited<ReturnType<typeof createServerClient>> | Awaited<ReturnType<typeof createServiceClient>>,
  input: {
    context: SubjectContext
    action: string
    previousStatus?: string | null
    newStatus?: string | null
    reason?: string | null
    consentVersionId?: string | null
    consentEventId?: string | null
    documentId?: string | null
    signatureRequestId?: string | null
    actorUserId: string | null
    eventPayload?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('subject_consent_audit').insert({
    organization_id: input.context.organizationId,
    study_id: input.context.studyId,
    study_subject_id: input.context.subjectId,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    reason: input.reason ?? null,
    consent_version_id: input.consentVersionId ?? null,
    consent_event_id: input.consentEventId ?? null,
    document_id: input.documentId ?? null,
    signature_request_id: input.signatureRequestId ?? null,
    actor_user_id: input.actorUserId,
    event_payload: input.eventPayload ?? {},
  })
  if (error) throw new Error(error.message)
}

async function syncLegacyConsent(context: SubjectContext, consentVersionId: string, signedAt: string) {
  const supabase = await createServerClient()
  await supabase
    .from('study_subjects')
    .update({ consent_signed_at: signedAt, consent_version_id: consentVersionId })
    .eq('id', context.subjectId)
}

async function syncLegacyPrivacyConsent(context: SubjectContext, privacyConsent: boolean) {
  const supabase = await createServerClient()
  await supabase
    .from('study_subjects')
    .update({ privacy_consent: privacyConsent })
    .eq('id', context.subjectId)
}

async function isRequestSigned(requestId: string | null) {
  if (!requestId) return false
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('operational_signature_requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle()
  return data?.status === 'signed'
}

async function requireSessionUser() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  return sessionUser
}

function contextFromRow(row: Record<string, unknown>): SubjectContext {
  return {
    subjectId: String(row.study_subject_id),
    studyId: String(row.study_id),
    organizationId: String(row.organization_id),
    legacyConsentSignedAt: null,
    legacyConsentVersionId: null,
    legacyPrivacyConsent: false,
  }
}

function mapVersionRow(row: Record<string, unknown>) {
  const coordinatorSignature = relation(row.coordinator_signature)
  const piSignature = relation(row.pi_signature)
  return {
    id: String(row.id),
    studySubjectId: String(row.study_subject_id),
    studyId: String(row.study_id),
    organizationId: String(row.organization_id),
    consentType: row.consent_type as ConsentType,
    consentVersionLabel: String(row.consent_version_label),
    protocolVersion: stringOrNull(row.protocol_version),
    amendmentIdentifier: stringOrNull(row.amendment_identifier),
    consentDocumentVersionId: stringOrNull(row.consent_document_version_id),
    language: String(row.language ?? 'en'),
    status: row.status as ConsentStatus,
    effectiveAt: stringOrNull(row.effective_at),
    expiresAt: stringOrNull(row.expires_at),
    supersedesConsentVersionId: stringOrNull(row.supersedes_consent_version_id),
    supersededByConsentVersionId: stringOrNull(row.superseded_by_consent_version_id),
    coordinatorSignatureRequestId: stringOrNull(row.coordinator_signature_request_id),
    piSignatureRequestId: stringOrNull(row.pi_signature_request_id),
    coordinatorSignatureStatus: stringOrNull(coordinatorSignature?.status),
    piSignatureStatus: stringOrNull(piSignature?.status),
    requiresPiReview: Boolean(row.requires_pi_review),
    completionMethod: completionMethod(row) as 'electronic_patient_signature' | 'paper_signed_attested' | 'imported_legacy' | null,
    consentDocumentUploadPending: metadataObject(row.metadata).consent_document_upload_pending === true,
    patientSignatureId: stringOrNull(row.patient_signature_id),
    larGuardianSignatureId: stringOrNull(row.lar_guardian_signature_id),
    witnessSignatureId: stringOrNull(row.witness_signature_id),
    completedAt: stringOrNull(row.completed_at),
    activeAt: stringOrNull(row.active_at),
    lockedAt: stringOrNull(row.locked_at),
    reason: stringOrNull(row.reason),
    createdAt: String(row.created_at),
  }
}

function mapMasterConsentVersionRow(row: Record<string, unknown>): MasterConsentDocumentVersionRow {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    consentType: String(row.consent_type),
    versionNumber: Number(row.version_number ?? 1),
    versionLabel: stringOrNull(row.version_label),
    irbApprovalDate: stringOrNull(row.irb_approval_date),
    effectiveDate: String(row.effective_date),
    expirationDate: stringOrNull(row.expiration_date),
    reconsentRequired: Boolean(row.reconsent_required),
    requiredByDate: stringOrNull(row.required_by_date),
    amendmentIdentifier: stringOrNull(row.amendment_identifier),
    status: String(row.status),
    reviewStatus: String(row.review_status),
    extractionConfidence:
      row.extraction_confidence === null || row.extraction_confidence === undefined
        ? null
        : Number(row.extraction_confidence),
    optionalClauseChanged: Boolean(row.optional_clause_changed),
    language: String(row.language ?? 'en'),
  }
}

function mapClauseRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    consentDocumentVersionId: String(row.consent_document_version_id),
    clauseType: String(row.clause_type),
    clauseStatus: String(row.clause_status),
    extractedText: stringOrNull(row.extracted_text),
    extractionConfidence:
      row.extraction_confidence === null || row.extraction_confidence === undefined
        ? null
        : Number(row.extraction_confidence),
    requiresOptionalPermission: Boolean(row.requires_optional_permission),
    requiresReconsentOnChange: Boolean(row.requires_reconsent_on_change),
  }
}

function mapReconsentRequirementRow(row: Record<string, unknown>): ReconsentRequirementRow {
  const subject = relation(row.study_subjects)
  return {
    id: String(row.id),
    studySubjectId: String(row.study_subject_id),
    subjectIdentifier: subject?.subject_identifier ? String(subject.subject_identifier) : null,
    consentDocumentVersionId: String(row.consent_document_version_id),
    currentSubjectConsentVersionId: stringOrNull(row.current_subject_consent_version_id),
    consentOutdated: Boolean(row.consent_outdated),
    reconsentRequired: Boolean(row.reconsent_required),
    pendingConsentVersionId: stringOrNull(row.pending_consent_version_id),
    consentActionRequired: Boolean(row.consent_action_required),
    reconsentDueDate: stringOrNull(row.reconsent_due_date),
    reconsentStatus: row.reconsent_status as ReconsentRequirementRow['reconsentStatus'],
    reason: String(row.reason),
    detectedAt: String(row.detected_at),
  }
}

function mapPatientSessionRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    consentDocumentVersionId: stringOrNull(row.consent_document_version_id),
    subjectConsentVersionId: stringOrNull(row.subject_consent_version_id),
    tokenHint: String(row.token_hint),
    scope: 'consent_only' as const,
    language: row.language === 'es' ? 'es' as const : 'en' as const,
    status: String(row.status),
    expiresAt: String(row.expires_at),
    sentAt: stringOrNull(row.sent_at),
    lastViewedAt: stringOrNull(row.last_viewed_at),
    createdAt: String(row.created_at),
  }
}

function mapPatientSignatureRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    patientSessionId: String(row.patient_session_id),
    subjectConsentVersionId: stringOrNull(row.subject_consent_version_id),
    consentEventId: stringOrNull(row.consent_event_id),
    signerType:
      row.signer_type === 'lar_guardian'
        ? 'lar_guardian' as const
        : row.signer_type === 'witness'
          ? 'witness' as const
          : 'patient' as const,
    signerName: String(row.signer_name),
    signatureMethod: String(row.signature_method),
    signedAt: String(row.signed_at),
  }
}

function mapEventRow(row: Record<string, unknown>) {
  const signature = relation(row.signature)
  return {
    id: String(row.id),
    consentVersionId: stringOrNull(row.consent_version_id),
    eventType: String(row.event_type),
    eventStatus: row.event_status as ConsentStatus,
    eventAt: String(row.event_at),
    reason: stringOrNull(row.reason),
    signatureRequestId: stringOrNull(row.signature_request_id),
    signatureStatus: stringOrNull(signature?.status),
  }
}

function mapDocumentRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    consentVersionId: stringOrNull(row.consent_version_id),
    consentEventId: stringOrNull(row.consent_event_id),
    documentKind: String(row.document_kind),
    fileName: String(row.file_name),
    filePath: stringOrNull(row.file_path),
    externalDocumentId: stringOrNull(row.external_document_id),
    linkedAt: String(row.linked_at),
  }
}

function mapPermissionRow(row: Record<string, unknown>) {
  const signature = relation(row.signature)
  return {
    id: String(row.id),
    consentVersionId: stringOrNull(row.consent_version_id),
    permissionType: row.permission_type as OptionalPermissionType,
    permissionStatus: row.permission_status as OptionalPermissionStatus,
    effectiveAt: stringOrNull(row.effective_at),
    changedReason: stringOrNull(row.changed_reason),
    signatureRequestId: stringOrNull(row.signature_request_id),
    signatureStatus: stringOrNull(signature?.status),
    updatedAt: String(row.updated_at),
  }
}

function mapWithdrawalRow(row: Record<string, unknown>) {
  const signature = relation(row.acknowledgment_signature)
  return {
    id: String(row.id),
    consentVersionId: stringOrNull(row.consent_version_id),
    withdrawalScope: String(row.withdrawal_scope),
    reason: String(row.reason),
    withdrawnAt: String(row.withdrawn_at),
    acknowledgmentSignatureRequestId: stringOrNull(row.acknowledgment_signature_request_id),
    acknowledgmentSignatureStatus: stringOrNull(signature?.status),
    acknowledgedAt: stringOrNull(row.acknowledged_at),
    lockedAt: stringOrNull(row.locked_at),
  }
}

function relation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function metadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function stringOrNull(value: unknown): string | null {
  return value ? String(value) : null
}

function clean(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function parseConsentDate(value: string) {
  const parsed = new Date(value)
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error('A valid consent date/time is required.')
  }
  if (parsed.getTime() > Date.now()) {
    throw new Error('Consent date/time cannot be in the future.')
  }
  return parsed.toISOString()
}

function consentTypeToEventType(consentType: ConsentType) {
  if (consentType === 'optional_consent') return 'optional_permission_update'
  return consentType
}

function revalidateSubject(subjectId: string) {
  revalidatePath(`/subjects/${subjectId}`)
  revalidatePath(`/subjects/${subjectId}?tab=consent`)
}
