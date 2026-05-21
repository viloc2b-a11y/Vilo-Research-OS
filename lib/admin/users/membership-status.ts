export const ORGANIZATION_MEMBER_STATUSES = ['active', 'inactive', 'deactivated'] as const

export type OrganizationMemberStatus = (typeof ORGANIZATION_MEMBER_STATUSES)[number]

export function normalizeMembershipStatus(raw: string | null | undefined): OrganizationMemberStatus {
  const value = String(raw ?? 'active').trim().toLowerCase()
  if (value === 'inactive' || value === 'deactivated') return value
  return 'active'
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

export function isMembershipActive(status: OrganizationMemberStatus): boolean {
  return status === 'active'
}
