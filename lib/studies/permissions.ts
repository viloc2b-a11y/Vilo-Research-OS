import type { OrganizationMembership } from '@/lib/auth/session'

export function isOrgAdminForOrganization(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return memberships.some(
    (m) =>
      m.organization_id === organizationId && (m.role === 'owner' || m.role === 'admin'),
  )
}

export function orgAdminOrganizations(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return memberships.filter((m) => m.role === 'owner' || m.role === 'admin')
}
