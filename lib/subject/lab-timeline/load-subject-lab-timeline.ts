import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'visit-documents'
const LAB_DOCUMENT_TYPE = 'Labs'
const LAB_TIMELINE_LIMIT = 200

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function asDate(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

export type SubjectLabTimelineItem = {
  documentId: string
  visitId: string
  visitLabel: string
  visitCode: string | null
  visitDate: string | null
  fileName: string
  notes: string | null
  uploadedAt: string
  previewUrl: string | null
  downloadUrl: string | null
}

export async function loadSubjectLabTimeline(input: {
  studySubjectId: string
  organizationId: string
  studyId?: string | null
}): Promise<{ items: SubjectLabTimelineItem[]; error: string | null }> {
  const supabase = await createServerClient()

  let request = supabase
    .from('subject_visit_documents')
    .select(
      `
      id,
      subject_visit_id,
      file_name,
      file_path,
      notes,
      uploaded_at,
      visits (
        id,
        scheduled_date,
        visit_definitions (
          label,
          code
        )
      )
    `,
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('document_type', LAB_DOCUMENT_TYPE)
    .order('uploaded_at', { ascending: false })
    .limit(LAB_TIMELINE_LIMIT)

  if (input.studyId) {
    request = request.eq('study_id', input.studyId)
  }

  const { data, error } = await request
  if (error) return { items: [], error: error.message }

  const service = await createServiceClient()
  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const visits = one(
        row.visits as
          | {
              id?: string
              scheduled_date?: string | null
              visit_definitions?: { label?: string; code?: string } | { label?: string; code?: string }[]
            }
          | null
          | undefined,
      )
      const definition = one(visits?.visit_definitions) as { label?: string; code?: string } | null
      const visitDate = visits?.scheduled_date ?? null
      const documentId = row.id as string
      const fileName = row.file_name as string
      const filePath = (row.file_path as string | null) ?? null

      const previewUrl = filePath
        ? (await service.storage.from(BUCKET).createSignedUrl(filePath, 60 * 10)).data?.signedUrl ?? null
        : null
      const downloadUrl = filePath
        ? (
            await service.storage.from(BUCKET).createSignedUrl(filePath, 60 * 10, {
              download: fileName,
            })
          ).data?.signedUrl ?? null
        : null

      return {
        documentId,
        visitId: (visits?.id as string) ?? (row.subject_visit_id as string),
        visitLabel: definition?.label ?? definition?.code ?? 'Visit',
        visitCode: definition?.code ?? null,
        visitDate,
        fileName,
        notes: (row.notes as string | null) ?? null,
        uploadedAt: row.uploaded_at as string,
        previewUrl,
        downloadUrl,
      }
    }),
  )

  return {
    items: items.sort((a, b) => asDate(a.visitDate) - asDate(b.visitDate) || a.uploadedAt.localeCompare(b.uploadedAt)),
    error: null,
  }
}
