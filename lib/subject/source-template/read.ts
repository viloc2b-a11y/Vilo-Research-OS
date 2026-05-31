import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import type {
  SubjectDocument,
  SubjectSourceTemplateModel,
  SubjectUserOption,
  SubjectVisitOption,
} from '@/lib/subject/source-template/types'

const BUCKET = 'visit-documents'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function addSignedUrls(rows: SubjectDocument[]) {
  if (!rows.length) return rows
  const service = await createServiceClient()
  return Promise.all(
    rows.map(async (row) => {
      if (!row.file_path) return row
      const { data } = await service.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 10)
      const { data: download } = await service.storage
        .from(BUCKET)
        .createSignedUrl(row.file_path, 60 * 10, { download: row.file_name })
      return {
        ...row,
        previewUrl: data?.signedUrl ?? null,
        downloadUrl: download?.signedUrl ?? null,
      }
    }),
  )
}

export async function loadSubjectSourceTemplate(input: {
  subjectId: string
  organizationId: string
}): Promise<SubjectSourceTemplateModel> {
  const supabase = await createServerClient()

  const [
    statusHistory,
    notes,
    documents,
    reviews,
    signatureRequests,
    signatures,
    deviations,
    deviationHistory,
    contacts,
    visits,
    members,
  ] =
    await Promise.all([
      supabase
        .from('subject_status_history')
        .select('status_id, status, start_date, stop_date, ongoing, reason, notes, created_by, created_at, updated_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('start_date', { ascending: false }),
      supabase
        .from('subject_progress_notes')
        .select('note_id, note_date, note_type, category, chief_complaint, note, assessment, plan, follow_up_needed, follow_up_date, follow_up_owner, created_by, created_at, updated_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_documents')
        .select('document_id, visit_id, compliance_document_id, document_category, file_name, file_path, mime_type, file_size, status, notes, uploaded_by, created_at, updated_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_document_review_requests')
        .select('request_id, document_id, request_type, requested_by, requested_to, message, due_date, status, completed_by, completed_at, rejection_reason, rejected_by, rejected_at, rescind_reason, rescinded_by, rescinded_at, signature_request_id, created_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('operational_signature_requests')
        .select('id, artifact_type, artifact_id, required_role, signature_meaning, status, requested_by, requested_at, expires_at, metadata')
        .eq('subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('requested_at', { ascending: false }),
      supabase
        .from('operational_signatures')
        .select('id, request_id, artifact_type, artifact_id, signer_user_id, signed_at, status, metadata')
        .eq('subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('signed_at', { ascending: false }),
      supabase
        .from('subject_protocol_deviations')
        .select('deviation_id, description, deviation_date, start_date, stop_date, resolution_date, ongoing, category, severity, root_cause, root_cause_category, capa, corrective_action, preventive_action, capa_due_date, capa_completion_date, capa_effectiveness_check_date, status, closed_at, closed_by, closure_date, closure_note, created_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('deviation_date', { ascending: false }),
      supabase
        .from('subject_clinical_profile_events')
        .select('event_id, record_id, event_type, actor_id, occurred_at, change_reason')
        .eq('study_subject_id', input.subjectId)
        .eq('section', 'protocol_deviations')
        .order('occurred_at', { ascending: false })
        .limit(100),
      supabase
        .from('subject_emergency_contacts')
        .select('contact_id, name, relationship, phone, email, address, primary_contact, preferred_method, availability, language, privacy_consent, notes, archived_at, created_at')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('visits')
        .select('id, visit_definitions(label, code)')
        .eq('study_subject_id', input.subjectId)
        .eq('organization_id', input.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', input.organizationId)
        .limit(100),
    ])

  const documentRows = ((documents.data ?? []) as SubjectDocument[]).map((row) => ({
    ...row,
    file_size: row.file_size == null ? null : Number(row.file_size),
    previewUrl: null,
    downloadUrl: null,
  }))

  const visitOptions: SubjectVisitOption[] = (visits.data ?? []).map((row) => {
    const definition = one(row.visit_definitions) as { label?: string; code?: string } | null
    return {
      id: row.id as string,
      label: definition?.label ?? definition?.code ?? 'Visit',
    }
  })

  const userOptions: SubjectUserOption[] = (members.data ?? []).map((row) => ({
    id: row.user_id as string,
    label: `${row.role ?? 'Staff'} · ${(row.user_id as string).slice(0, 8)}`,
    role: (row.role as string | null) ?? null,
  }))

  const signatureRows = (signatureRequests.data ?? []).map((request) => {
    const metadata = (request.metadata ?? {}) as Record<string, unknown>
    const signed = (signatures.data ?? []).find((sig) => sig.request_id === request.id)
    return {
      signature_id: (signed?.id as string | undefined) ?? (request.id as string),
      request_id: request.id as string,
      signature_type: String(metadata.signature_type ?? request.artifact_type ?? 'Subject signature'),
      requested_by: (request.requested_by as string | null) ?? null,
      requested_to: (metadata.requested_to as string | null) ?? null,
      related_section: String(metadata.related_section ?? request.artifact_type ?? 'Subject'),
      related_document_id:
        request.artifact_type === 'subject_document' ? (request.artifact_id as string) : null,
      related_record_id: (metadata.related_record_id as string | null) ?? null,
      status: signed
        ? 'Signed'
        : String(metadata.display_status ?? (request.status === 'pending' ? 'Pending' : request.status)),
      signed_by: (signed?.signer_user_id as string | null | undefined) ?? null,
      signed_at: (signed?.signed_at as string | null | undefined) ?? null,
      attestation_text: String(metadata.attestation_text ?? request.signature_meaning ?? ''),
      due_date: (request.expires_at as string | null) ?? null,
      completed_at: (signed?.signed_at as string | null | undefined) ?? null,
      created_at: request.requested_at as string,
    }
  })

  return {
    statusHistory: statusHistory.data ?? [],
    notes: notes.data ?? [],
    documents: await addSignedUrls(documentRows),
      reviewRequests: reviews.data ?? [],
      signatures: signatureRows,
      deviations: deviations.data ?? [],
      deviationHistory: deviationHistory.data ?? [],
    emergencyContacts: contacts.data ?? [],
    visitOptions,
    userOptions,
  } as SubjectSourceTemplateModel
}
