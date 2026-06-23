'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import {
  type CreateAccessRecordInput,
  type UpdateAccessRecordInput,
  type AccessActionResult,
} from './study-system-access'

/**
 * Initialize default access records for all active systems in a study.
 * Creates one record per system for the specified role.
 */
export async function initializeSystemAccess(
  studyId: string,
  role: string,
): Promise<AccessActionResult> {
  try {
    const supabase = await createServerClient()

    // Get all active systems for this study
    const { data: systems, error: sysError } = await supabase
      .from('study_systems')
      .select('study_system_id')
      .eq('study_id', studyId)
      .eq('active', true)

    if (sysError) return { ok: false, error: sysError.message }
    if (!systems || systems.length === 0) {
      return { ok: false, error: 'No active systems found for this study' }
    }

    // Check which access records already exist for this role
    const { data: existing } = await supabase
      .from('study_system_access')
      .select('study_system_id')
      .eq('study_id', studyId)
      .eq('role', role)

    const existingIds = new Set((existing ?? []).map((r: { study_system_id: string }) => r.study_system_id))

    // Insert only missing records
    const toInsert = systems
      .filter((s: { study_system_id: string }) => !existingIds.has(s.study_system_id))
      .map((s: { study_system_id: string }) => ({
        study_system_id: s.study_system_id,
        study_id: studyId,
        role,
        access_status: 'Not Requested',
      }))

    if (toInsert.length === 0) {
      return { ok: true }
    }

    const { error } = await supabase.from('study_system_access').insert(toInsert)
    if (error) return { ok: false, error: error.message }

    revalidatePath(`/studies/${studyId}/workspace`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to initialize access records',
    }
  }
}

/**
 * Create a single access record.
 */
export async function createAccessRecord(
  input: CreateAccessRecordInput,
): Promise<AccessActionResult> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('study_system_access')
      .insert({
        study_system_id: input.studySystemId,
        study_id: input.studyId,
        role: input.role,
        access_status: input.accessStatus ?? 'Not Requested',
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath(`/studies/${input.studyId}/workspace`)
    return { ok: true, data: data as AccessActionResult['data'] }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create access record',
    }
  }
}

/**
 * Update an access record's status, dates, and notes.
 */
export async function updateAccessRecord(
  input: UpdateAccessRecordInput,
): Promise<AccessActionResult> {
  try {
    const supabase = await createServerClient()

    const updates: Record<string, unknown> = {
      access_status: input.accessStatus,
    }
    if (input.requestedAt !== undefined) updates.requested_at = input.requestedAt
    if (input.grantedAt !== undefined) updates.granted_at = input.grantedAt
    if (input.notes !== undefined) updates.notes = input.notes

    // Auto-set timestamps based on status transitions
    if (input.accessStatus === 'Requested' && !input.requestedAt) {
      updates.requested_at = new Date().toISOString()
    }
    if (input.accessStatus === 'Active' && !input.grantedAt) {
      updates.granted_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('study_system_access')
      .update(updates)
      .eq('access_id', input.accessId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath(`/studies/${data.study_id}/workspace`)
    return { ok: true, data: data as AccessActionResult['data'] }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update access record',
    }
  }
}

/**
 * Delete an access record.
 */
export async function deleteAccessRecord(
  accessId: string,
): Promise<AccessActionResult> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('study_system_access')
      .delete()
      .eq('access_id', accessId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath(`/studies/${data.study_id}/workspace`)
    return { ok: true, data: data as AccessActionResult['data'] }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete access record',
    }
  }
}
