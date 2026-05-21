import { activeMemberships } from '@/lib/auth/membership-access'
import type { OrganizationMembership } from '@/lib/auth/session'

export function organizationIdsFromMemberships(
  memberships: OrganizationMembership[],
): string[] {
  return [
    ...new Set(
      activeMemberships(memberships).map((membership) => membership.organization_id),
    ),
  ]
}

export function hasOrganizationMembership(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return activeMemberships(memberships).some(
    (membership) => membership.organization_id === organizationId,
  )
}
