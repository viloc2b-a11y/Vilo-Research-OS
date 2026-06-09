'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { hasSiteAdminAccess } from '@/lib/rbac/permissions'
import { logAuditEvent } from '@/lib/audit/log'

export async function updateOrganizationProfile(
  organizationId: string,
  data: {
    name: string
    legal_name: string | null
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    tax_id: string | null
    npi: string | null
    clia: string | null
  }
) {
  const user = await getSessionUser()
  if (!user) throw new Error('Unauthorized')

  const memberships = await getOrganizationMemberships(user.id)
  
  if (!hasSiteAdminAccess(memberships, organizationId)) {
    throw new Error('Forbidden: You do not have admin access for this organization.')
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('organizations')
    .update(data)
    .eq('id', organizationId)

  if (error) {
    throw new Error(`Failed to update organization: ${error.message}`)
  }

  await logAuditEvent({
    organizationId,
    actorUserId: user.id,
    action: 'update_organization_profile',
    target: `organization:${organizationId}`,
    metadata: { updated_fields: Object.keys(data) }
  })

  revalidatePath('/admin/organization')
}
