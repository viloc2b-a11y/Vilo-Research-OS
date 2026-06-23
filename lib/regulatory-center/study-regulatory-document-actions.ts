'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import type { StudyRegulatoryDocumentEntry, CreateStudyRegDocInput, UpdateStudyRegDocInput } from './study-regulatory-documents'

export type StudyRegDocResult = { ok: boolean; error?: string; data?: StudyRegulatoryDocumentEntry }

export async function createStudyRegulatoryDocument(input: CreateStudyRegDocInput): Promise<StudyRegDocResult> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Not authenticated' }
    const supabase = await createServerClient()

    const { data: study } = await supabase.from('studies').select('organization_id').eq('id', input.studyId).single()
    if (!study) return { ok: false, error: 'Study not found' }

    const { data, error } = await supabase.from('study_regulatory_documents').insert({
      organization_id: study.organization_id,
      study_id: input.studyId,
      document_type: input.documentType,
      document_title: input.documentTitle,
      document_reference: input.documentReference ?? null,
      version: input.version ?? null,
      effective_date: input.effectiveDate ?? null,
      expiration_date: input.expirationDate ?? null,
      status: input.status ?? 'missing',
      owner_role: input.ownerRole ?? null,
      required: input.required ?? false,
      notes: input.notes ?? null,
      created_by: user.id,
    }).select().single()

    if (error) return { ok: false, error: error.message }
    revalidatePath('/regulatory-center')
    return { ok: true, data: data as StudyRegulatoryDocumentEntry }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function updateStudyRegulatoryDocument(input: UpdateStudyRegDocInput): Promise<StudyRegDocResult> {
  try {
    const supabase = await createServerClient()
    const updates: Record<string, unknown> = {}
    if (input.documentType !== undefined) updates.document_type = input.documentType
    if (input.documentTitle !== undefined) updates.document_title = input.documentTitle
    if (input.documentReference !== undefined) updates.document_reference = input.documentReference
    if (input.version !== undefined) updates.version = input.version
    if (input.effectiveDate !== undefined) updates.effective_date = input.effectiveDate
    if (input.expirationDate !== undefined) updates.expiration_date = input.expirationDate
    if (input.status !== undefined) updates.status = input.status
    if (input.ownerRole !== undefined) updates.owner_role = input.ownerRole
    if (input.required !== undefined) updates.required = input.required
    if (input.notes !== undefined) updates.notes = input.notes

    const { data, error } = await supabase.from('study_regulatory_documents').update(updates).eq('id', input.id).select().single()
    if (error) return { ok: false, error: error.message }
    revalidatePath('/regulatory-center')
    return { ok: true, data: data as StudyRegulatoryDocumentEntry }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deactivateStudyRegDoc(id: string): Promise<StudyRegDocResult> {
  return updateStudyRegulatoryDocument({ id, status: 'not_applicable' })
}
