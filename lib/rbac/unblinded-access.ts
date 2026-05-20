import type { OrganizationMembership } from '@/lib/auth/session'
import { anyMembershipHasEffectiveRole } from '@/lib/rbac/effective-roles'
import { normalizeOrganizationRole } from '@/lib/rbac/roles'

/**
 * View unblinded operational and subject fields. Owner always; site admin does not
 * receive automatic unblinded access per product policy.
 */
export function canViewUnblindedDataForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'unblinded_coordinator'
    || normalized === 'unblinded_cra'
  )
}

export function canViewUnblindedData(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipHasEffectiveRole(
    memberships,
    (role) => canViewUnblindedDataForRole(role),
    organizationId,
  )
}
