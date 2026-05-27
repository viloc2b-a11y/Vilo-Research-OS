import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type SourceBlueprintEvidenceAuthContext =
  | { ok: true; userId: string; memberships: OrganizationMembership[] }
  | { ok: false; status: number; message: string }

export async function authorizeSourceBlueprintEvidenceRead(
  organizationId: string,
): Promise<SourceBlueprintEvidenceAuthContext> {
  const user = await getSessionUser()
  if (!user) return { ok: false, status: 401, message: 'Unauthorized' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  return { ok: true, userId: user.id, memberships }
}

export async function authorizeSourceBlueprintEvidenceWrite(
  organizationId: string,
): Promise<SourceBlueprintEvidenceAuthContext> {
  const auth = await authorizeSourceBlueprintEvidenceRead(organizationId)
  if (!auth.ok) return auth

  if (!canManageSourceBuilder(auth.memberships, organizationId)) {
    return {
      ok: false,
      status: 403,
      message: 'Your role does not allow source blueprint evidence review.',
    }
  }

  return auth
}
