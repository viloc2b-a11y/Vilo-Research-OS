'use server'

import { revalidatePath } from 'next/cache'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  VISIT_DOCUMENT_TYPES,
  type VisitDocumentActionState,
  type VisitDocumentRow,
  type VisitDocumentType,
} from '@/lib/subject/visit-documents/types'

const BUCKET = 'visit-documents'
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

function documentsPath(studyId: string, subjectId: string, visitId: string) {
  return `/studies/${studyId}/subjects/${subjectId}/visits/${visitId}/documents`
}

function slugFileName(name: string) {
  const parts = name.split('.')
  const ext = parts.length > 1 ? `.${parts.pop()}` : ''
  const base = parts.join('.') || 'document'
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${ext.toLowerCase()}`
}

async function resolveVisitContext(input: {
  studyId: string | null
  subjectId: string | null
  visitId: string | null
}) {
  if (!input.studyId || !input.subjectId || !input.visitId) {
    return { ok: false as const, error: 'Missing visit document context.' }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('visits')
    .select('id, organization_id, study_id, study_subject_id')
    .eq('id', input.visitId)
    .eq('study_id', input.studyId)
    .eq('study_subject_id', input.subjectId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: 'Visit not found for this subject.' }
  if (!memberships.some((m) => m.organization_id === data.organization_id)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }

  return {
    ok: true as const,
    user,
    supabase,
    orgId: data.organization_id as string,
    studyId: data.study_id as string,
    subjectId: data.study_subject_id as string,
    visitId: data.id as string,
  }
}

function mapDocument(row: Record<string, unknown>): VisitDocumentRow {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    studyId: row.study_id as string,
    studySubjectId: row.study_subject_id as string,
    visitId: row.subject_visit_id as string,
    documentType: row.document_type as VisitDocumentType,
    fileName: row.file_name as string,
    filePath: row.file_path as string,
    mimeType: row.mime_type as string,
    fileSize: Number(row.file_size ?? 0),
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    uploadedAt: row.uploaded_at as string,
    notes: (row.notes as string | null) ?? null,
    previewUrl: null,
    downloadUrl: null,
  }
}

async function addSignedUrls(rows: VisitDocumentRow[]) {
  if (!rows.length) return rows
  const service = await createServiceClient()
  return Promise.all(
    rows.map(async (row) => {
      const { data } = await service.storage
        .from(BUCKET)
        .createSignedUrl(row.filePath, 60 * 10, {
          download: false,
        })
      const { data: download } = await service.storage
        .from(BUCKET)
        .createSignedUrl(row.filePath, 60 * 10, {
          download: row.fileName,
        })
      return {
        ...row,
        previewUrl: data?.signedUrl ?? null,
        downloadUrl: download?.signedUrl ?? null,
      }
    }),
  )
}

export async function listVisitDocuments(input: {
  studyId: string
  subjectId: string
  visitId: string
}) {
  const ctx = await resolveVisitContext(input)
  if (!ctx.ok) return { ok: false as const, error: ctx.error, data: [] }

  const { data, error } = await ctx.supabase
    .from('subject_visit_documents')
    .select(
      'id, org_id, study_id, study_subject_id, subject_visit_id, document_type, file_name, file_path, mime_type, file_size, uploaded_by, uploaded_at, notes',
    )
    .eq('subject_visit_id', ctx.visitId)
    .order('uploaded_at', { ascending: false })

  if (error) return { ok: false as const, error: error.message, data: [] }
  const rows = (data ?? []).map((row) => mapDocument(row as Record<string, unknown>))
  return { ok: true as const, data: await addSignedUrls(rows) }
}

export async function uploadVisitDocumentAction(
  _prev: VisitDocumentActionState,
  formData: FormData,
): Promise<VisitDocumentActionState> {
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('study_subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const documentType = clean(formData.get('document_type')) as VisitDocumentType | null
  const notes = clean(formData.get('notes'))
  const file = formData.get('file')

  const ctx = await resolveVisitContext({ studyId, subjectId, visitId })
  if (!ctx.ok) return { ok: false, message: ctx.error }

  if (!documentType || !VISIT_DOCUMENT_TYPES.includes(documentType)) {
    return { ok: false, message: 'Select a valid document type.' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a PDF, JPG, or PNG file.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, message: 'Only PDF, JPG, and PNG files are supported.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, message: 'File is too large. Maximum size is 25 MB.' }
  }

  const safeName = slugFileName(file.name)
  const filePath = [
    'orgs',
    ctx.orgId,
    'studies',
    ctx.studyId,
    'subjects',
    ctx.subjectId,
    'visits',
    ctx.visitId,
    'documents',
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join('/')

  const service = await createServiceClient()
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { ok: false, message: uploadError.message }

  const { error: insertError } = await ctx.supabase.from('subject_visit_documents').insert({
    org_id: ctx.orgId,
    study_id: ctx.studyId,
    study_subject_id: ctx.subjectId,
    subject_visit_id: ctx.visitId,
    document_type: documentType,
    file_name: file.name,
    file_path: filePath,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: ctx.user.id,
    notes,
  })

  if (insertError) {
    await service.storage.from(BUCKET).remove([filePath])
    return { ok: false, message: insertError.message }
  }

  revalidatePath(documentsPath(ctx.studyId, ctx.subjectId, ctx.visitId))
  revalidatePath(`/visits/${ctx.visitId}`)
  return { ok: true, message: 'Document uploaded.' }
}

export async function deleteVisitDocumentAction(
  _prev: VisitDocumentActionState,
  formData: FormData,
): Promise<VisitDocumentActionState> {
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('study_subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const documentId = clean(formData.get('document_id'))

  const ctx = await resolveVisitContext({ studyId, subjectId, visitId })
  if (!ctx.ok) return { ok: false, message: ctx.error }
  if (!documentId) return { ok: false, message: 'Missing document id.' }

  const { data: row, error: fetchError } = await ctx.supabase
    .from('subject_visit_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('subject_visit_id', ctx.visitId)
    .maybeSingle()

  if (fetchError) return { ok: false, message: fetchError.message }
  if (!row) return { ok: false, message: 'Document not found.' }

  const { error: deleteError } = await ctx.supabase
    .from('subject_visit_documents')
    .delete()
    .eq('id', documentId)
    .eq('subject_visit_id', ctx.visitId)

  if (deleteError) return { ok: false, message: deleteError.message }

  const service = await createServiceClient()
  await service.storage.from(BUCKET).remove([row.file_path as string])

  revalidatePath(documentsPath(ctx.studyId, ctx.subjectId, ctx.visitId))
  revalidatePath(`/visits/${ctx.visitId}`)
  return { ok: true, message: 'Document removed.' }
}
