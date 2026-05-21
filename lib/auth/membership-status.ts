export const ORGANIZATION_MEMBER_STATUSES = ['active', 'inactive', 'deactivated'] as const

export type OrganizationMemberStatus = (typeof ORGANIZATION_MEMBER_STATUSES)[number]

/** Normalize DB status; null/empty → active (pre-migration rows). */
export function normalizeMembershipStatus(
  raw: string | null | undefined,
): OrganizationMemberStatus {
  if (raw == null || String(raw).trim() === '') return 'active'
  const value = String(raw).trim().toLowerCase()
  if (value === 'inactive' || value === 'deactivated') return value
  return 'active'
}

/** Only active memberships grant operational / RBAC access. */
export function isOperationalMembershipStatus(
  raw: string | null | undefined,
): boolean {
  return normalizeMembershipStatus(raw) === 'active'
}

export function membershipStatusLabel(status: OrganizationMemberStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'deactivated':
      return 'Deactivated'
    default:
      return 'Active'
  }
}
