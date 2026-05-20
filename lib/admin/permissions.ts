import type { OrganizationMembership } from '@/lib/auth/session'
import {
  canAccessAdminSection as rbacCanAccessAdminSection,
  siteAdminOrganizationSummaries,
} from '@/lib/rbac/permissions'

/** Admin hub — owner and site admin only. */
export function canAccessAdminSection(memberships: OrganizationMembership[]): boolean {
  return rbacCanAccessAdminSection(memberships)
}

export function adminOrganizationSummaries(memberships: OrganizationMembership[]): {
  id: string
  name: string
  role: string
}[] {
  return siteAdminOrganizationSummaries(memberships).map(({ id, name, role }) => ({
    id,
    name,
    role,
  }))
}
