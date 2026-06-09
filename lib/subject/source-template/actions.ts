'use server'

import { revalidatePath } from 'next/cache'
import { subjectChartRevalidatePaths } from '@/lib/ops/paths'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures/create-signature-request'
import {
  type OperationalSignatureMeaning,
} from '@/lib/operational-signatures/operational-signature-types'
import { writeProfileEvent } from '@/lib/subject/clinical-profile/audit'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { SUBJECT_DOCUMENT_CATEGORIES } from '@/lib/subject/source-template/types'

// Subject profile mutations are audited through writeProfileEvent into subject_clinical_profile_events.
const BUCKET = 'visit-documents'
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])

export type SubjectActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_SUBJECT_ACTION_STATE: SubjectActionState = {
  ok: false,
  message: null,
}

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

function slugFileName(name: string) {
  const parts = name.split('.')
  const ext = parts.length > 1 ? `.${parts.pop()}` : ''
  const base = parts.join('.') || 'document'
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${ext.toLowerCase()}`
}

async function resolveSubjectContext(studySubjectId: string | null) {
  if (!studySubjectId) return { ok: false as const, error: 'Missing subject context.' }
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Sign in required.' }

  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('organization_id, study_id')
    .eq('id', studySubjectId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!subject) return { ok: false as const, error: 'Subject not found.' }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    organizationId: subject.organization_id as string,
    studyId: subject.study_id as string,
    subjectId: studySubjectId,
  }
}

async function revalidateSubject(subjectId: string, studyId: string | null) {
  for (const path of subjectChartRevalidatePaths(subjectId, studyId)) {
    revalidatePath(path)
  }
}

async function audit(input: {
  subjectId: string
  section:
    | 'progress_notes'
    | 'subject_status'
    | 'subject_documents'
    | 'document_reviews'
    | 'subject_signatures'
    | 'protocol_deviations'
    | 'emergency_contacts'
  recordId: string
  action: 'created' | 'updated' | 'status_changed'
  before?: Record<string, unknown> | null
  after: Record<string, unknown>
  reason?: string | null
}) {
  await writeProfileEvent({
    study_subject_id: input.subjectId,
    section: input.section,
    record_id: input.recordId,
    event_type: input.action,
    before_snapshot: input.before ?? null,
    after_snapshot: input.after,
    change_reason: input.reason ?? null,
    source_attribution: 'Subject Runtime',
  })
}

export async function addSubjectStatusHistory(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const status = clean(formData.get('status'))
  const startDate = clean(formData.get('start_date'))
  const stopDate = clean(formData.get('stop_date'))
  const ongoing = clean(formData.get('ongoing')) === 'on'
  if (!status || !startDate) return { ok: false, message: 'Status and Start Date are required.' }
  if (ongoing && stopDate) {
    return { ok: false, message: 'Stop Date must be empty when Ongoing is selected.' }
  }

  const { data, error } = await ctx.supabase
    .from('subject_status_history')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      status,
      start_date: startDate,
      stop_date: stopDate,
      ongoing,
      reason: clean(formData.get('reason')),
      notes: clean(formData.get('notes')),
      created_by: ctx.userId,
    })
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'subject_status',
    recordId: data.status_id,
    action: 'created',
    after: data,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Subject status added.' }
}

export async function updateSubjectStatusHistory(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const statusId = clean(formData.get('status_id'))
  const status = clean(formData.get('status'))
  const startDate = clean(formData.get('start_date'))
  const stopDate = clean(formData.get('stop_date'))
  const ongoing = clean(formData.get('ongoing')) === 'on'
  if (!statusId || !status || !startDate) {
    return { ok: false, message: 'Status record, Status, and Start Date are required.' }
  }
  if (ongoing && stopDate) {
    return { ok: false, message: 'Stop Date must be empty when Ongoing is selected.' }
  }

  const { data: before } = await ctx.supabase
    .from('subject_status_history')
    .select('*')
    .eq('status_id', statusId)
    .maybeSingle()
  const { data, error } = await ctx.supabase
    .from('subject_status_history')
    .update({
      status,
      start_date: startDate,
      stop_date: stopDate,
      ongoing,
      reason: clean(formData.get('reason')),
      notes: clean(formData.get('notes')),
    })
    .eq('status_id', statusId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'subject_status',
    recordId: statusId,
    action: 'updated',
    before: before as Record<string, unknown>,
    after: data,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Subject status updated.' }
}

export async function addSubjectProgressNote(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const note = clean(formData.get('note'))
  if (!note) return { ok: false, message: 'Note is required.' }
  const category = clean(formData.get('category')) ?? 'General operational note'
  const noteDate = clean(formData.get('note_date')) ?? new Date().toISOString().slice(0, 10)

  const { data, error } = await ctx.supabase
    .from('subject_progress_notes')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      note_date: noteDate,
      note_type: clean(formData.get('note_type')),
      category,
      chief_complaint: clean(formData.get('chief_complaint')),
      note,
      assessment: clean(formData.get('assessment')),
      plan: clean(formData.get('plan')),
      follow_up_needed: clean(formData.get('follow_up_needed')) === 'on',
      follow_up_date: clean(formData.get('follow_up_date')),
      follow_up_owner: clean(formData.get('follow_up_owner')),
      created_by: ctx.userId,
    })
    .select('note_id, note_date, note_type, category, chief_complaint, note, assessment, plan, follow_up_needed, follow_up_date, follow_up_owner, created_by, created_at')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({ subjectId: ctx.subjectId, section: 'progress_notes', recordId: data.note_id, action: 'created', after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Progress note added.' }
}

export async function uploadSubjectDocumentAction(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const category = clean(formData.get('document_category'))
  const visitId = clean(formData.get('visit_id'))
  const notes = clean(formData.get('notes'))
  const file = formData.get('file')
  if (!category || !SUBJECT_DOCUMENT_CATEGORIES.includes(category as never)) {
    return { ok: false, message: 'Select a valid document category.' }
  }
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a document.' }
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, message: 'Only PDF, JPG, and PNG files are supported.' }
  if (file.size > MAX_FILE_SIZE) return { ok: false, message: 'File is too large. Maximum size is 25 MB.' }

  const safeName = slugFileName(file.name)
  const filePath = [
    'orgs',
    ctx.organizationId,
    'studies',
    ctx.studyId,
    'subjects',
    ctx.subjectId,
    'documents',
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join('/')

  const service = await createServiceClient()
  const { error: uploadError } = await service.storage.from(BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return { ok: false, message: uploadError.message }

  const { data, error } = await ctx.supabase
    .from('subject_documents')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      visit_id: visitId,
      document_category: category,
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type,
      file_size: file.size,
      document_date: clean(formData.get('document_date')),
      notes,
      uploaded_by: ctx.userId,
    })
    .select('document_id, document_category, file_name, visit_id, status, notes')
    .single()

  if (error) {
    await service.storage.from(BUCKET).remove([filePath])
    return { ok: false, message: error.message }
  }
  await audit({ subjectId: ctx.subjectId, section: 'subject_documents', recordId: data.document_id, action: 'created', after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Document uploaded to subject.' }
}

export async function assignComplianceDocumentToSubject(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const category = clean(formData.get('document_category'))
  const complianceDocumentId = clean(formData.get('compliance_document_id'))
  const fileName = clean(formData.get('file_name')) ?? 'Assigned document'
  const visitId = clean(formData.get('visit_id'))
  if (!category || !SUBJECT_DOCUMENT_CATEGORIES.includes(category as never)) {
    return { ok: false, message: 'Select a valid document category.' }
  }
  if (!complianceDocumentId) return { ok: false, message: 'Existing document id is required.' }

  const { data, error } = await ctx.supabase
    .from('subject_documents')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      visit_id: visitId,
      compliance_document_id: complianceDocumentId,
      document_category: category,
      file_name: fileName,
      status: 'Available',
      uploaded_by: ctx.userId,
    })
    .select('document_id, compliance_document_id, document_category, file_name, visit_id, status')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({ subjectId: ctx.subjectId, section: 'subject_documents', recordId: data.document_id, action: 'created', after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Document assigned to subject.' }
}

export async function requestSubjectDocumentReview(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const documentId = clean(formData.get('document_id'))
  const requestType = clean(formData.get('request_type')) === 'Signature' ? 'Signature' : 'Review'
  const requestedTo = clean(formData.get('requested_to'))
  const message = clean(formData.get('message'))
  const dueDate = clean(formData.get('due_date'))
  if (!documentId) return { ok: false, message: 'Select a document.' }
  if (!requestedTo) return { ok: false, message: 'Select a reviewer or signer.' }
  const status = requestType === 'Signature' ? 'Signature Requested' : 'Review Requested'
  const signatureMeaning: OperationalSignatureMeaning = requestType === 'Signature' ? 'approved_by' : 'reviewed_by'

  if (requestType === 'Signature' || requestType === 'Review') {
    const { data: document } = await ctx.supabase
      .from('subject_documents')
      .select('document_id, visit_id, file_name, document_category')
      .eq('document_id', documentId)
      .eq('study_subject_id', ctx.subjectId)
      .maybeSingle()
    if (!document) return { ok: false, message: 'Document not found.' }

    const request = await createOperationalSignatureRequest(ctx.supabase, {
      organizationId: ctx.organizationId,
      studyId: ctx.studyId,
      subjectId: ctx.subjectId,
      visitId: (document.visit_id as string | null) ?? null,
      artifactType: 'subject_document',
      artifactId: documentId,
      requiredRole: clean(formData.get('required_role')) ?? 'pi',
      signatureMeaning,
      requestedBy: ctx.userId,
      metadata: {
        requested_to: requestedTo,
        comment: message,
        due_date: dueDate,
        signature_type: requestType === 'Signature' ? 'Document signature' : 'Document review',
        related_section: 'Documents',
        related_document_id: documentId,
        document_name: document.file_name,
        document_category: document.document_category,
        attestation_text: requestType === 'Signature' ? 'I reviewed and signed this subject document.' : 'I reviewed this subject document.',
        display_status: status,
      },
    })
    if (dueDate) {
      await ctx.supabase
        .from('operational_signature_requests')
        .update({ expires_at: `${dueDate}T23:59:59.999Z` })
        .eq('id', request.id)
    }

    if (requestType === 'Signature') {
      await ctx.supabase.from('subject_documents').update({ status }).eq('document_id', documentId)
      await audit({
        subjectId: ctx.subjectId,
        section: 'subject_signatures',
        recordId: request.id,
        action: 'created',
        after: {
          ...request,
          requested_to: requestedTo,
          related_document_id: documentId,
        },
      })
      await revalidateSubject(ctx.subjectId, ctx.studyId)
      return { ok: true, message: 'Signature requested.' }
    }

    const { data, error } = await ctx.supabase
      .from('subject_document_review_requests')
      .insert({
        organization_id: ctx.organizationId,
        study_id: ctx.studyId,
        study_subject_id: ctx.subjectId,
        document_id: documentId,
        request_type: requestType,
        requested_by: ctx.userId,
        requested_to: requestedTo,
        message,
        due_date: dueDate,
        status,
        signature_request_id: request.id,
        status_history: [
          {
            status,
            timestamp: new Date().toISOString(),
            by: ctx.userId,
          },
        ],
      })
      .select('*')
      .single()
    if (error) return { ok: false, message: error.message }
    await ctx.supabase.from('subject_documents').update({ status }).eq('document_id', documentId)
    await audit({ subjectId: ctx.subjectId, section: 'document_reviews', recordId: data.request_id, action: 'created', after: data })
    await revalidateSubject(ctx.subjectId, ctx.studyId)
    return { ok: true, message: `${requestType} requested.` }
  }

  return { ok: false, message: 'Invalid request type.' }
}

export async function completeSubjectDocumentRequest(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const requestId = clean(formData.get('request_id'))
  const status = clean(formData.get('status')) ?? 'Reviewed'
  if (!requestId) return { ok: false, message: 'Missing request.' }
  
  const { data: before } = await ctx.supabase
    .from('subject_document_review_requests')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle()

  if (!before) return { ok: false, message: 'Review request not found.' }

  if (before.signature_request_id) {
    const { data: sigReq } = await ctx.supabase
      .from('operational_signature_requests')
      .select('status')
      .eq('id', before.signature_request_id)
      .maybeSingle()
    if (sigReq?.status !== 'signed') {
      return { ok: false, message: 'Electronic signature is required to complete this review.' }
    }
  }

  const { data, error } = await ctx.supabase
    .from('subject_document_review_requests')
    .update({
      status,
      completed_by: ctx.userId,
      completed_at: new Date().toISOString(),
      status_history: [
        ...(Array.isArray(before?.status_history) ? before.status_history : []),
        { status, timestamp: new Date().toISOString(), by: ctx.userId },
      ],
    })
    .eq('request_id', requestId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await ctx.supabase.from('subject_documents').update({ status }).eq('document_id', data.document_id)
  await audit({ subjectId: ctx.subjectId, section: 'document_reviews', recordId: requestId, action: 'status_changed', before: before as Record<string, unknown>, after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Request status updated.' }
}

export async function transitionSubjectDocumentRequest(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const requestId = clean(formData.get('request_id'))
  const nextStatus = clean(formData.get('status'))
  const reason = clean(formData.get('reason'))
  if (!requestId || !nextStatus) return { ok: false, message: 'Missing request transition.' }
  if ((nextStatus === 'Rejected' || nextStatus === 'Rescinded') && !reason) {
    return { ok: false, message: `${nextStatus} reason is required.` }
  }

  const { data: before } = await ctx.supabase
    .from('subject_document_review_requests')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle()
  if (!before) return { ok: false, message: 'Request not found.' }
  const history = Array.isArray(before.status_history) ? before.status_history : []
  const patch =
    nextStatus === 'Rejected'
      ? {
          status: 'Rejected',
          rejection_reason: reason,
          rejection_notified_to_requester: clean(formData.get('notify_requester')) === 'on',
          rejection_notified_date: clean(formData.get('notify_requester')) === 'on' ? new Date().toISOString().slice(0, 10) : null,
          rejected_by: ctx.userId,
          rejected_at: new Date().toISOString(),
          status_history: [...history, { status: 'Rejected', timestamp: new Date().toISOString(), by: ctx.userId, reason }],
        }
      : {
          status: 'Rescinded',
          rescind_reason: reason,
          rescinded_by: ctx.userId,
          rescinded_at: new Date().toISOString(),
          status_history: [...history, { status: 'Rescinded', timestamp: new Date().toISOString(), by: ctx.userId, reason }],
        }

  const { data, error } = await ctx.supabase
    .from('subject_document_review_requests')
    .update(patch)
    .eq('request_id', requestId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await ctx.supabase.from('subject_documents').update({ status: nextStatus }).eq('document_id', data.document_id)
  await audit({
    subjectId: ctx.subjectId,
    section: 'document_reviews',
    recordId: requestId,
    action: 'status_changed',
    before: before as Record<string, unknown>,
    after: data,
    reason,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: `Request ${nextStatus.toLowerCase()}.` }
}

export async function requestSubjectSignature(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const signatureType = clean(formData.get('signature_type'))
  const requestedTo = clean(formData.get('requested_to'))
  const relatedSection = clean(formData.get('related_section'))
  const relatedDocumentId = clean(formData.get('related_document_id'))
  const relatedRecordId = clean(formData.get('related_record_id'))
  const attestationText = clean(formData.get('attestation_text'))
  if (!signatureType || !requestedTo || !relatedSection || !attestationText) {
    return { ok: false, message: 'Signature type, signer, section, and meaning are required.' }
  }

  const artifactId = relatedDocumentId ?? relatedRecordId ?? ctx.subjectId
  const request = await createOperationalSignatureRequest(ctx.supabase, {
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    subjectId: ctx.subjectId,
    artifactType: relatedDocumentId ? 'subject_document' : 'operational_signature_test_fixture',
    artifactId,
    requiredRole: clean(formData.get('required_role')) ?? 'pi',
    signatureMeaning: (clean(formData.get('signature_meaning')) as OperationalSignatureMeaning | null) ?? 'reviewed_by',
    requestedBy: ctx.userId,
    metadata: {
      requested_to: requestedTo,
      signature_type: signatureType,
      related_section: relatedSection,
      related_record_id: relatedRecordId,
      related_document_id: relatedDocumentId,
      attestation_text: attestationText,
      display_status: 'Pending',
      operational_signature_test_fixture: relatedDocumentId
        ? undefined
        : {
            subject_id: ctx.subjectId,
            signature_type: signatureType,
            related_section: relatedSection,
            related_record_id: relatedRecordId,
            attestation_text: attestationText,
          },
    },
  })
  await audit({ subjectId: ctx.subjectId, section: 'subject_signatures', recordId: request.id, action: 'created', after: request })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Subject signature requested.' }
}

export async function completeSubjectSignature(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const requestId = clean(formData.get('request_id')) ?? clean(formData.get('signature_id'))
  if (!requestId) return { ok: false, message: 'Missing signature.' }
  const { data: request } = await ctx.supabase
    .from('operational_signature_requests')
    .select('status, artifact_type, artifact_id')
    .eq('id', requestId)
    .maybeSingle()
  if (request?.status !== 'signed') {
    return { ok: false, message: 'Signature is not signed yet.' }
  }
  if (request?.artifact_type === 'subject_document') {
    await ctx.supabase
      .from('subject_documents')
      .update({ status: 'Signed' })
      .eq('document_id', request.artifact_id)
  }
  await audit({
    subjectId: ctx.subjectId,
    section: 'subject_signatures',
    recordId: requestId,
    action: 'status_changed',
    after: {
      request_id: requestId,
      artifact_type: request?.artifact_type ?? null,
      artifact_id: request?.artifact_id ?? null,
      status: 'Signed',
      signed_from: 'Subject Runtime',
      completed_at: new Date().toISOString(),
    },
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Subject signature completed.' }
}

export async function transitionSubjectSignatureRequest(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const requestId = clean(formData.get('request_id'))
  const nextStatus = clean(formData.get('status'))
  const reason = clean(formData.get('reason'))
  if (!requestId || !nextStatus) return { ok: false, message: 'Missing signature transition.' }
  if ((nextStatus === 'Rejected' || nextStatus === 'Rescinded') && !reason) {
    return { ok: false, message: `${nextStatus} reason is required.` }
  }
  const { data: before } = await ctx.supabase
    .from('operational_signature_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()
  if (!before) return { ok: false, message: 'Signature request not found.' }
  const metadata = ((before.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>
  const dbStatus = nextStatus === 'Rejected' ? 'rejected' : 'rescinded'
  const afterMetadata = {
    ...metadata,
    display_status: nextStatus,
    [`${dbStatus}_reason`]: reason,
    [`${dbStatus}_by`]: ctx.userId,
    [`${dbStatus}_at`]: new Date().toISOString(),
  }
  const { data, error } = await ctx.supabase
    .from('operational_signature_requests')
    .update({ status: dbStatus, metadata: afterMetadata })
    .eq('id', requestId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  if (before.artifact_type === 'subject_document') {
    await ctx.supabase
      .from('subject_documents')
      .update({ status: nextStatus })
      .eq('document_id', before.artifact_id)
  }
  await audit({
    subjectId: ctx.subjectId,
    section: 'subject_signatures',
    recordId: requestId,
    action: 'status_changed',
    before: before as Record<string, unknown>,
    after: data,
    reason,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: `Signature request ${nextStatus.toLowerCase()}.` }
}

export async function addSubjectProtocolDeviation(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const description = clean(formData.get('description'))
  const deviationDate = clean(formData.get('deviation_date'))
  const startDate = clean(formData.get('start_date')) ?? deviationDate
  const stopDate = clean(formData.get('stop_date'))
  const resolutionDate = clean(formData.get('resolution_date'))
  const ongoing = clean(formData.get('ongoing')) === 'on'
  if (!description || !deviationDate) return { ok: false, message: 'Description and date are required.' }
  if (ongoing && (stopDate || resolutionDate)) {
    return { ok: false, message: 'Stop Date must be empty when Ongoing is selected.' }
  }
  if (!ongoing && !stopDate && !resolutionDate) {
    return { ok: false, message: 'Stop Date or resolution date is required when Ongoing is not selected.' }
  }
  const { data, error } = await ctx.supabase
    .from('subject_protocol_deviations')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      description,
      deviation_date: deviationDate,
      start_date: startDate,
      stop_date: stopDate,
      resolution_date: resolutionDate,
      ongoing,
      category: clean(formData.get('category')),
      severity: clean(formData.get('severity')),
      root_cause: clean(formData.get('root_cause')),
      root_cause_category: clean(formData.get('root_cause_category')),
      impact: clean(formData.get('impact')),
      impact_on_subject_safety: clean(formData.get('impact_on_subject_safety')) === 'on',
      impact_on_data_integrity: clean(formData.get('impact_on_data_integrity')) === 'on',
      capa: clean(formData.get('capa')),
      corrective_action: clean(formData.get('corrective_action')),
      preventive_action: clean(formData.get('preventive_action')),
      capa_due_date: clean(formData.get('capa_due_date')),
      capa_completion_date: clean(formData.get('capa_completion_date')),
      capa_effectiveness_check_date: clean(formData.get('capa_effectiveness_check_date')),
      reported_to_sponsor: clean(formData.get('reported_to_sponsor')) === 'on',
      reported_to_sponsor_date: clean(formData.get('reported_to_sponsor_date')),
      reported_to_irb: clean(formData.get('reported_to_irb')) === 'on',
      reported_to_irb_date: clean(formData.get('reported_to_irb_date')),
      notes: clean(formData.get('notes')),
      status: clean(formData.get('status')) ?? 'Open',
      created_by: ctx.userId,
    })
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({ subjectId: ctx.subjectId, section: 'protocol_deviations', recordId: data.deviation_id, action: 'created', after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Confirmed protocol deviation added.' }
}

export async function updateSubjectProtocolDeviation(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const deviationId = clean(formData.get('deviation_id'))
  const description = clean(formData.get('description'))
  const deviationDate = clean(formData.get('deviation_date'))
  const stopDate = clean(formData.get('stop_date'))
  const resolutionDate = clean(formData.get('resolution_date'))
  const ongoing = clean(formData.get('ongoing')) === 'on'
  if (!deviationId || !description || !deviationDate) {
    return { ok: false, message: 'Deviation, description, and date are required.' }
  }
  if (ongoing && (stopDate || resolutionDate)) {
    return { ok: false, message: 'Stop Date must be empty when Ongoing is selected.' }
  }
  const { data: before } = await ctx.supabase
    .from('subject_protocol_deviations')
    .select('*')
    .eq('deviation_id', deviationId)
    .maybeSingle()
  const { data, error } = await ctx.supabase
    .from('subject_protocol_deviations')
    .update({
      description,
      deviation_date: deviationDate,
      start_date: clean(formData.get('start_date')) ?? deviationDate,
      stop_date: stopDate,
      resolution_date: resolutionDate,
      ongoing,
      category: clean(formData.get('category')),
      severity: clean(formData.get('severity')),
      root_cause: clean(formData.get('root_cause')),
      root_cause_category: clean(formData.get('root_cause_category')),
      impact: clean(formData.get('impact')),
      capa: clean(formData.get('capa')),
      corrective_action: clean(formData.get('corrective_action')),
      preventive_action: clean(formData.get('preventive_action')),
      capa_due_date: clean(formData.get('capa_due_date')),
      capa_completion_date: clean(formData.get('capa_completion_date')),
      capa_effectiveness_check_date: clean(formData.get('capa_effectiveness_check_date')),
      notes: clean(formData.get('notes')),
      status: clean(formData.get('status')) ?? 'Open',
    })
    .eq('deviation_id', deviationId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'protocol_deviations',
    recordId: deviationId,
    action: 'updated',
    before: before as Record<string, unknown>,
    after: data,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Confirmed protocol deviation updated.' }
}

export async function closeSubjectProtocolDeviation(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const deviationId = clean(formData.get('deviation_id'))
  const closureDate = clean(formData.get('closure_date'))
  const closureNote = clean(formData.get('closure_note'))
  const capaCompletionDate = clean(formData.get('capa_completion_date'))
  if (!deviationId || !closureDate || !closureNote) {
    return { ok: false, message: 'Closure date and closure note are required.' }
  }
  const { data: before } = await ctx.supabase
    .from('subject_protocol_deviations')
    .select('*')
    .eq('deviation_id', deviationId)
    .maybeSingle()
  if (!before) return { ok: false, message: 'Deviation not found.' }
  if (before.capa && !capaCompletionDate && !before.capa_completion_date) {
    return { ok: false, message: 'CAPA completion date is required when CAPA exists.' }
  }
  const { data, error } = await ctx.supabase
    .from('subject_protocol_deviations')
    .update({
      status: 'Closed',
      ongoing: false,
      stop_date: closureDate,
      resolution_date: closureDate,
      closure_date: closureDate,
      closure_note: closureNote,
      capa_completion_date: capaCompletionDate ?? before.capa_completion_date,
      closed_by: ctx.userId,
      closed_at: new Date().toISOString(),
    })
    .eq('deviation_id', deviationId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'protocol_deviations',
    recordId: deviationId,
    action: 'status_changed',
    before: before as Record<string, unknown>,
    after: data,
    reason: closureNote,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Confirmed protocol deviation closed.' }
}

export async function addSubjectEmergencyContact(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const name = clean(formData.get('name'))
  if (!name) return { ok: false, message: 'Contact name is required.' }
  const { data, error } = await ctx.supabase
    .from('subject_emergency_contacts')
    .insert({
      organization_id: ctx.organizationId,
      study_id: ctx.studyId,
      study_subject_id: ctx.subjectId,
      name,
      relationship: clean(formData.get('relationship')),
      phone: clean(formData.get('phone')),
      email: clean(formData.get('email')),
      address: clean(formData.get('address')),
      primary_contact: clean(formData.get('primary_contact')) === 'on',
      preferred_method: clean(formData.get('preferred_method')),
      availability: clean(formData.get('availability')),
      language: clean(formData.get('language')),
      privacy_consent: clean(formData.get('privacy_consent')) === 'on',
      notes: clean(formData.get('notes')),
      created_by: ctx.userId,
    })
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({ subjectId: ctx.subjectId, section: 'emergency_contacts', recordId: data.contact_id, action: 'created', after: data })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Emergency contact added.' }
}

export async function updateSubjectEmergencyContact(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const contactId = clean(formData.get('contact_id'))
  const name = clean(formData.get('name'))
  if (!contactId || !name) return { ok: false, message: 'Contact and name are required.' }
  const { data: before } = await ctx.supabase
    .from('subject_emergency_contacts')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle()
  const { data, error } = await ctx.supabase
    .from('subject_emergency_contacts')
    .update({
      name,
      relationship: clean(formData.get('relationship')),
      phone: clean(formData.get('phone')),
      email: clean(formData.get('email')),
      address: clean(formData.get('address')),
      primary_contact: clean(formData.get('primary_contact')) === 'on',
      preferred_method: clean(formData.get('preferred_method')),
      availability: clean(formData.get('availability')),
      language: clean(formData.get('language')),
      privacy_consent: clean(formData.get('privacy_consent')) === 'on',
      notes: clean(formData.get('notes')),
    })
    .eq('contact_id', contactId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'emergency_contacts',
    recordId: contactId,
    action: 'updated',
    before: before as Record<string, unknown>,
    after: data,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Emergency contact updated.' }
}

export async function archiveSubjectEmergencyContact(
  _prev: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const ctx = await resolveSubjectContext(clean(formData.get('study_subject_id')))
  if (!ctx.ok) return { ok: false, message: ctx.error }
  const contactId = clean(formData.get('contact_id'))
  if (!contactId) return { ok: false, message: 'Missing contact.' }
  const { data: before } = await ctx.supabase
    .from('subject_emergency_contacts')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle()
  const { data, error } = await ctx.supabase
    .from('subject_emergency_contacts')
    .update({ archived_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .select('*')
    .single()
  if (error) return { ok: false, message: error.message }
  await audit({
    subjectId: ctx.subjectId,
    section: 'emergency_contacts',
    recordId: contactId,
    action: 'updated',
    before: before as Record<string, unknown>,
    after: data,
  })
  await revalidateSubject(ctx.subjectId, ctx.studyId)
  return { ok: true, message: 'Emergency contact archived.' }
}
