import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canAccessSubjectVisitWorkspace, canMutateOrganizationData } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type OperationalSignatureAuthContext =
  | { ok: true; userId: string; memberships: OrganizationMembership[] }
  | { ok: false; status: number; message: string }

export async function authorizeOperationalSignatureRead(
  organizationId: string,
): Promise<OperationalSignatureAuthContext> {
  const user = await getSessionUser()
  if (!user) return { ok: false, status: 401, message: 'Unauthorized' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  return { ok: true, userId: user.id, memberships }
}

export async function authorizeOperationalSignatureWrite(
  organizationId: string,
): Promise<OperationalSignatureAuthContext> {
  const auth = await authorizeOperationalSignatureRead(organizationId)
  if (!auth.ok) return auth

  if (
    !canAccessSubjectVisitWorkspace(auth.memberships, organizationId)
    && !canMutateOrganizationData(auth.memberships, organizationId)
  ) {
    return {
      ok: false,
      status: 403,
      message: 'Your role does not allow operational signature actions.',
    }
  }

  return auth
}
