'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import type {
  CreatePersonnelInput,
  UpdatePersonnelInput,
  PersonnelActionResult,
  RegulatoryPersonnelEntry,
} from './regulatory-personnel'

// ── Create ────────────────────────────────────────────────────────────────────

export async function createRegulatoryPersonnel(
  input: CreatePersonnelInput,
): Promise<PersonnelActionResult> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const orgId = await getPrimaryOrganizationId(user.id)
    if (!orgId) return { ok: false, error: 'No organization found' }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('regulatory_personnel')
      .insert({
        organization_id: orgId,
        full_name: input.fullName,
        role: input.role,
        email: input.email ?? null,
        phone: input.phone ?? null,
        npi: input.npi ?? null,
        license_number: input.licenseNumber ?? null,
        dea_number: input.deaNumber ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as RegulatoryPersonnelEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create personnel',
    }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRegulatoryPersonnel(
  input: UpdatePersonnelInput,
): Promise<PersonnelActionResult> {
  try {
    const supabase = await createServerClient()

    const updates: Record<string, unknown> = {}
    if (input.fullName !== undefined) updates.full_name = input.fullName
    if (input.role !== undefined) updates.role = input.role
    if (input.email !== undefined) updates.email = input.email
    if (input.phone !== undefined) updates.phone = input.phone
    if (input.npi !== undefined) updates.npi = input.npi
    if (input.licenseNumber !== undefined) updates.license_number = input.licenseNumber
    if (input.deaNumber !== undefined) updates.dea_number = input.deaNumber
    if (input.status !== undefined) updates.status = input.status
    if (input.notes !== undefined) updates.notes = input.notes

    const { data, error } = await supabase
      .from('regulatory_personnel')
      .update(updates)
      .eq('id', input.id)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as RegulatoryPersonnelEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update personnel',
    }
  }
}

// ── Deactivate (soft delete) ─────────────────────────────────────────────────

export async function deactivateRegulatoryPersonnel(
  id: string,
): Promise<PersonnelActionResult> {
  return updateRegulatoryPersonnel({ id, status: 'inactive' })
}

export async function reactivateRegulatoryPersonnel(
  id: string,
): Promise<PersonnelActionResult> {
  return updateRegulatoryPersonnel({ id, status: 'active' })
}
