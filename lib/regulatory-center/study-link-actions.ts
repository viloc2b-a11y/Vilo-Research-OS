'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import type { StudyRegulatoryLinkEntry } from './study-regulatory-links'

export type LinkActionResult = {
  ok: boolean
  error?: string
  data?: StudyRegulatoryLinkEntry
}

/**
 * Link personnel to a study.
 */
export async function linkPersonnelToStudy(
  studyId: string,
  personnelId: string,
  required = false,
  notes?: string | null,
): Promise<LinkActionResult> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const supabase = await createServerClient()

    // Get the organization from the study
    const { data: study } = await supabase
      .from('studies')
      .select('organization_id')
      .eq('id', studyId)
      .single()

    if (!study) return { ok: false, error: 'Study not found' }

    const { data, error } = await supabase
      .from('study_regulatory_links')
      .insert({
        organization_id: study.organization_id,
        study_id: studyId,
        link_type: 'personnel',
        personnel_id: personnelId,
        required,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as StudyRegulatoryLinkEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to link personnel',
    }
  }
}

/**
 * Link a master document to a study.
 */
export async function linkDocumentToStudy(
  studyId: string,
  masterDocumentId: string,
  required = false,
  notes?: string | null,
): Promise<LinkActionResult> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const supabase = await createServerClient()

    const { data: study } = await supabase
      .from('studies')
      .select('organization_id')
      .eq('id', studyId)
      .single()

    if (!study) return { ok: false, error: 'Study not found' }

    const { data, error } = await supabase
      .from('study_regulatory_links')
      .insert({
        organization_id: study.organization_id,
        study_id: studyId,
        link_type: 'document',
        master_document_id: masterDocumentId,
        required,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as StudyRegulatoryLinkEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to link document',
    }
  }
}

/**
 * Update a link's status or required flag.
 */
export async function updateStudyLink(
  linkId: string,
  updates: { status?: string; required?: boolean; notes?: string | null },
): Promise<LinkActionResult> {
  try {
    const supabase = await createServerClient()

    const dbUpdates: Record<string, unknown> = {}
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.required !== undefined) dbUpdates.required = updates.required
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes

    const { data, error } = await supabase
      .from('study_regulatory_links')
      .update(dbUpdates)
      .eq('id', linkId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as StudyRegulatoryLinkEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update link',
    }
  }
}

/**
 * Deactivate a link (soft delete).
 */
export async function deactivateStudyLink(linkId: string): Promise<LinkActionResult> {
  return updateStudyLink(linkId, { status: 'inactive' })
}

/**
 * Reactivate a link.
 */
export async function reactivateStudyLink(linkId: string): Promise<LinkActionResult> {
  return updateStudyLink(linkId, { status: 'active' })
}
