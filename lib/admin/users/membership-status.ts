export {
  ORGANIZATION_MEMBER_STATUSES,
  membershipStatusLabel,
  normalizeMembershipStatus,
  type OrganizationMemberStatus,
} from '@/lib/auth/membership-status'

/** @deprecated Use isOperationalMembershipStatus from lib/auth/membership-status */
export function isMembershipActive(
  status: import('@/lib/auth/membership-status').OrganizationMemberStatus,
): boolean {
  return status === 'active'
}
