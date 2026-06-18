'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = requiredString(formData, key)
  return value || undefined
}

// ---------------------------------------------------------------------------
// createPartner
// ---------------------------------------------------------------------------

export async function createPartner(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/partners?result=error&reason=No+active+organization')
  }

  const name = requiredString(formData, 'name')
  const partner_type = requiredString(formData, 'partner_type')

  if (!name || !partner_type) {
    redirect('/recruitment/partners/new?result=error&reason=Name+and+partner+type+are+required')
  }

  const contact_name = optionalString(formData, 'contact_name')
  const contact_email = optionalString(formData, 'contact_email')
  const contact_phone = optionalString(formData, 'contact_phone')
  const notes = optionalString(formData, 'notes')

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('recruitment_partners')
    .insert({
      organization_id: organizationId,
      name,
      partner_type,
      status: 'active',
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
      contact_phone: contact_phone ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/recruitment/partners/new?result=error&reason=${encodeURIComponent(error?.message ?? 'Failed to create partner')}`,
    )
  }

  redirect(
    `/recruitment/partners/${data.id}?result=success&reason=${encodeURIComponent('Partner created')}`,
  )
}

// ---------------------------------------------------------------------------
// updatePartner
// ---------------------------------------------------------------------------

export async function updatePartner(formData: FormData): Promise<never> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    redirect('/recruitment/partners?result=error&reason=No+active+organization')
  }

  const partnerId = requiredString(formData, 'partnerId')
  if (!partnerId) {
    redirect('/recruitment/partners?result=error&reason=Partner+ID+required')
  }

  const supabase = await createServerClient()

  // Verify org ownership before mutating
  const { data: existing } = await supabase
    .from('recruitment_partners')
    .select('organization_id')
    .eq('id', partnerId)
    .single() as { data: { organization_id: string } | null }

  if (!existing || existing.organization_id !== organizationId) {
    redirect('/recruitment/partners?result=error&reason=Partner+not+found')
  }

  const status = optionalString(formData, 'status')

  // Build partial update — only listed fields
  const patch: Record<string, unknown> = {}
  if (status !== undefined) patch.status = status

  // Contact fields — allow clearing via explicit empty form submission
  const contactNameRaw = formData.get('contact_name')
  if (contactNameRaw !== null) {
    patch.contact_name = (contactNameRaw as string).trim() || null
  }

  const contactEmailRaw = formData.get('contact_email')
  if (contactEmailRaw !== null) {
    patch.contact_email = (contactEmailRaw as string).trim() || null
  }

  const contactPhoneRaw = formData.get('contact_phone')
  if (contactPhoneRaw !== null) {
    patch.contact_phone = (contactPhoneRaw as string).trim() || null
  }

  const notesRaw = formData.get('notes')
  if (notesRaw !== null) {
    patch.notes = (notesRaw as string).trim() || null
  }

  const { error } = await supabase
    .from('recruitment_partners')
    .update(patch)
    .eq('id', partnerId)
    .eq('organization_id', organizationId)

  if (error) {
    redirect(
      `/recruitment/partners/${partnerId}/edit?result=error&reason=${encodeURIComponent(error.message)}`,
    )
  }

  redirect(
    `/recruitment/partners/${partnerId}?result=success&reason=${encodeURIComponent('Partner updated')}`,
  )
}
