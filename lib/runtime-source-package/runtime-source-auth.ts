import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type RuntimeSourceAuthContext =
  | {
      ok: true
      userId: string
      memberships: OrganizationMembership[]
    }
  | { ok: false; status: number; message: string }

export async function authorizeRuntimeSourceRead(
  organizationId: string,
): Promise<RuntimeSourceAuthContext> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  return { ok: true, userId: user.id, memberships }
}

export async function authorizeRuntimeSourceWrite(
  organizationId: string,
): Promise<RuntimeSourceAuthContext> {
  const auth = await authorizeRuntimeSourceRead(organizationId)
  if (!auth.ok) return auth

  if (!canManageSourceBuilder(auth.memberships, organizationId)) {
    return {
      ok: false,
      status: 403,
      message: 'Your role does not allow runtime source package management.',
    }
  }

  return auth
}
