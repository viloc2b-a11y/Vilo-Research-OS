import type { OrganizationMembership } from '@/lib/auth/session'
import {
  hasSiteAdminAccess,
  membershipsWithSiteAdminAccess,
} from '@/lib/rbac/permissions'

/** Owner or site admin for a specific organization (study create, org-scoped admin writes). */
export function isOrgAdminForOrganization(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return hasSiteAdminAccess(memberships, organizationId)
}

/** @deprecated Prefer membershipsWithSiteAdminAccess — alias for study portfolio / New Study gate. */
export function orgAdminOrganizations(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return membershipsWithSiteAdminAccess(memberships)
}
