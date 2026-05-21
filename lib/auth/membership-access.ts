import type { OrganizationMembership } from '@/lib/auth/session'
import { isOperationalMembershipStatus } from '@/lib/auth/membership-status'
import {
  getOrganizationMemberships,
  getSessionUser,
} from '@/lib/auth/session'

/** Memberships that may access org-scoped ops (status active or null). */
export function activeMemberships(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return memberships.filter((m) => isOperationalMembershipStatus(m.status))
}

export function hasActiveOrganizationMembership(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return activeMemberships(memberships).some(
    (m) => m.organization_id === organizationId,
  )
}

/** @alias hasActiveOrganizationMembership */
export function canAccessOrganization(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return hasActiveOrganizationMembership(memberships, organizationId)
}

export async function getActiveOrganizationMemberships(
  userId: string,
): Promise<OrganizationMembership[]> {
  return activeMemberships(await getOrganizationMemberships(userId))
}

export type ActiveOrgAccessResult =
  | {
      ok: true
      user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
      memberships: OrganizationMembership[]
    }
  | { ok: false; message: string }

/**
 * Ensures the signed-in user has at least one active org membership.
 * When organizationId is set, requires active membership for that org.
 */
export async function requireActiveOrganizationAccess(
  organizationId?: string,
): Promise<ActiveOrgAccessResult> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, message: 'Sign in required.' }
  }

  const memberships = await getActiveOrganizationMemberships(user.id)
  if (memberships.length === 0) {
    return { ok: false, message: 'No active organization access.' }
  }

  if (
    organizationId &&
    !hasActiveOrganizationMembership(memberships, organizationId)
  ) {
    return {
      ok: false,
      message: 'You do not have active access to this organization.',
    }
  }

  return { ok: true, user, memberships }
}
