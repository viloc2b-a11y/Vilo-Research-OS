import type { OrganizationMembership } from '@/lib/auth/session'

export function organizationIdsFromMemberships(
  memberships: OrganizationMembership[],
): string[] {
  return [...new Set(memberships.map((membership) => membership.organization_id))]
}

export function hasOrganizationMembership(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return memberships.some((membership) => membership.organization_id === organizationId)
}
