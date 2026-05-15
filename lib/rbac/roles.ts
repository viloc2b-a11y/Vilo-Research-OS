/** Organization-level roles (auth foundation). Study-scoped roles arrive in a later migration. */
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member', 'read_only'] as const

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

export function isOrganizationAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin'
}
