import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type DocumentIntakeAuthContext =
  | {
      ok: true
      userId: string
      memberships: OrganizationMembership[]
    }
  | { ok: false; status: number; message: string }

export async function authorizeDocumentIntake(
  organizationId: string,
): Promise<DocumentIntakeAuthContext> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Your role does not allow document intake actions.' }
  }

  return { ok: true, userId: user.id, memberships }
}
