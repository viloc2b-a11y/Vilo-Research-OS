'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { loadSystemLibrary } from './system-library'
import {
  mapStudySystemRow,
  type AddCustomSystemInput,
  type AddFromLibraryInput,
  type StudySystemActionResult,
  type UpdateStudySystemInput,
} from './study-systems'

// ── Add from library ─────────────────────────────────────────────────────────

export async function addStudySystemFromLibrary(
  input: AddFromLibraryInput,
): Promise<StudySystemActionResult> {
  try {
    const user = await getSessionUser()
    const supabase = await createServerClient()

    // Look up the library entry to copy fields
    const catalog = await loadSystemLibrary(supabase, {})
    const libraryEntry = catalog.find((s) => s.system_id === input.librarySystemId)

    if (!libraryEntry) {
      return { ok: false, error: 'Library system not found' }
    }

    const { data, error } = await supabase
      .from('study_systems')
      .insert({
        study_id: input.studyId,
        system_library_id: input.librarySystemId,
        system_name: libraryEntry.system_name,
        vendor_name: libraryEntry.vendor_name,
        system_type: libraryEntry.system_type,
        system_category: libraryEntry.system_category,
        launch_url: input.launchUrl ?? libraryEntry.default_url,
        support_url: input.supportUrl ?? libraryEntry.support_url,
        training_url: input.trainingUrl ?? libraryEntry.training_url,
        login_notes: input.loginNotes ?? null,
        owner_role: input.ownerRole ?? null,
        is_custom: false,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath(`/studies/${input.studyId}/workspace`)
    return { ok: true, data: mapStudySystemRow(data) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add system from library',
    }
  }
}

// ── Add custom system ────────────────────────────────────────────────────────

export async function addStudySystemCustom(
  input: AddCustomSystemInput,
): Promise<StudySystemActionResult> {
  try {
    const user = await getSessionUser()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('study_systems')
      .insert({
        study_id: input.studyId,
        system_library_id: null,
        system_name: input.systemName,
        vendor_name: input.vendorName ?? null,
        system_type: input.systemType,
        system_category: input.systemCategory ?? null,
        launch_url: input.launchUrl ?? null,
        support_email: input.supportEmail ?? null,
        support_url: input.supportUrl ?? null,
        training_url: input.trainingUrl ?? null,
        login_notes: input.loginNotes ?? null,
        owner_role: input.ownerRole ?? null,
        is_custom: true,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath(`/studies/${input.studyId}/workspace`)
    return { ok: true, data: mapStudySystemRow(data) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add custom system',
    }
  }
}

// ── Update system ─────────────────────────────────────────────────────────────

export async function updateStudySystem(
  input: UpdateStudySystemInput,
): Promise<StudySystemActionResult> {
  try {
    const supabase = await createServerClient()

    const updates: Record<string, unknown> = {}
    if (input.launchUrl !== undefined) updates.launch_url = input.launchUrl
    if (input.supportEmail !== undefined) updates.support_email = input.supportEmail
    if (input.supportUrl !== undefined) updates.support_url = input.supportUrl
    if (input.trainingUrl !== undefined) updates.training_url = input.trainingUrl
    if (input.loginNotes !== undefined) updates.login_notes = input.loginNotes
    if (input.ownerRole !== undefined) updates.owner_role = input.ownerRole
    if (input.active !== undefined) updates.active = input.active
    if (input.pinned !== undefined) updates.pinned = input.pinned

    const { data, error } = await supabase
      .from('study_systems')
      .update(updates)
      .eq('study_system_id', input.studySystemId)
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    // Revalidate any path that contains this study's workspace
    revalidatePath(`/studies/${data.study_id}/workspace`)
    return { ok: true, data: mapStudySystemRow(data) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update system',
    }
  }
}

// ── Pin / Unpin ───────────────────────────────────────────────────────────────

export async function pinStudySystem(
  studySystemId: string,
): Promise<StudySystemActionResult> {
  return updateStudySystem({ studySystemId, pinned: true })
}

export async function unpinStudySystem(
  studySystemId: string,
): Promise<StudySystemActionResult> {
  return updateStudySystem({ studySystemId, pinned: false })
}

// ── Deactivate / Reactivate ───────────────────────────────────────────────────

export async function deactivateStudySystem(
  studySystemId: string,
): Promise<StudySystemActionResult> {
  return updateStudySystem({ studySystemId, active: false })
}

export async function reactivateStudySystem(
  studySystemId: string,
): Promise<StudySystemActionResult> {
  return updateStudySystem({ studySystemId, active: true })
}

// ── Delete ────────────────────────────────────────────────────────────────────

// ── Record launch event ────────────────────────────────────────────────────────

export async function recordSystemLaunch(
  studySystemId: string,
  studyId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getSessionUser()
    const supabase = await createServerClient()
    const { error } = await supabase.from('study_system_usage_events').insert({
      study_system_id: studySystemId,
      study_id: studyId,
      user_id: user?.id ?? null,
      event_type: 'launch',
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to record launch',
    }
  }
}

export async function deleteStudySystem(
  studySystemId: string,
): Promise<StudySystemActionResult> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('study_systems')
      .delete()
      .eq('study_system_id', studySystemId)
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: mapStudySystemRow(data) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete system',
    }
  }
}
