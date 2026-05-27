import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type DocumentIntelligenceAuthContext =
  | {
      ok: true
      userId: string
      memberships: OrganizationMembership[]
    }
  | { ok: false; status: number; message: string }

export async function authorizeDocumentIntelligenceRead(
  organizationId: string,
): Promise<DocumentIntelligenceAuthContext> {
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

export async function authorizeDocumentIntelligenceWrite(
  organizationId: string,
): Promise<DocumentIntelligenceAuthContext> {
  const auth = await authorizeDocumentIntelligenceRead(organizationId)
  if (!auth.ok) return auth

  if (!canManageSourceDocuments(auth.memberships, organizationId)) {
    return {
      ok: false,
      status: 403,
      message: 'Your role does not allow document intelligence actions.',
    }
  }

  return auth
}
