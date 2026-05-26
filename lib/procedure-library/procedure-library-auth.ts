import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import type { OrganizationMembership } from '@/lib/auth/session'

export type ProcedureLibraryAuthContext =
  | {
      ok: true
      userId: string
      memberships: OrganizationMembership[]
    }
  | { ok: false; status: number; message: string }

export async function authorizeProcedureLibraryRead(
  organizationId?: string | null,
): Promise<ProcedureLibraryAuthContext> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (organizationId && !canAccessOrganization(memberships, organizationId)) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  return { ok: true, userId: user.id, memberships }
}

export async function authorizeProcedureLibraryWrite(
  organizationId?: string | null,
): Promise<ProcedureLibraryAuthContext> {
  const auth = await authorizeProcedureLibraryRead(organizationId)
  if (!auth.ok) return auth

  if (organizationId && !canManageSourceBuilder(auth.memberships, organizationId)) {
    return {
      ok: false,
      status: 403,
      message: 'Your role does not allow procedure library management.',
    }
  }

  if (!organizationId) {
    const canManageAny = auth.memberships.some((membership) =>
      canManageSourceBuilder(auth.memberships, membership.organization_id),
    )
    if (!canManageAny) {
      return {
        ok: false,
        status: 403,
        message: 'Your role does not allow global procedure library management.',
      }
    }
  }

  return auth
}
