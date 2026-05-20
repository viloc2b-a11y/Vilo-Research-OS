/**
 * Multi-role membership resolution for organization_members.
 *
 * Backward compatible: legacy `role` column is always merged with `roles[]`.
 * Effective permissions are the UNION of all normalized roles (ANY grants TRUE).
 */

import type { OrganizationMembership } from '@/lib/auth/session'
import {
  normalizeOrganizationRole,
  type OrganizationRole,
} from '@/lib/rbac/roles'

export type MembershipRoleInput = {
  role?: string | null
  roles?: string[] | null
}

/** Normalize raw role strings; dedupe preserving first-seen order. */
export function normalizeEffectiveRoles(rawRoles: Iterable<string>): OrganizationRole[] {
  const seen = new Set<OrganizationRole>()
  const ordered: OrganizationRole[] = []

  for (const raw of rawRoles) {
    const normalized = normalizeOrganizationRole(String(raw ?? '').trim())
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    ordered.push(normalized)
  }

  return ordered
}

/**
 * Resolve all site roles for a membership row.
 * Merges `roles[]` and legacy `role`; empty roles falls back to role column only.
 */
export function resolveEffectiveRoles(input: MembershipRoleInput): OrganizationRole[] {
  const fromArray = Array.isArray(input.roles) ? input.roles : []
  const fromLegacy = input.role?.trim() ? [input.role.trim()] : []
  return normalizeEffectiveRoles([...fromArray, ...fromLegacy])
}

export function resolveEffectiveRolesForMembership(
  membership: OrganizationMembership,
  organizationId?: string,
): OrganizationRole[] {
  if (organizationId && membership.organization_id !== organizationId) {
    return []
  }
  return resolveEffectiveRoles(membership)
}

/** Primary role for display / legacy RLS column (first effective role). */
export function resolvePrimaryRole(input: MembershipRoleInput): OrganizationRole | null {
  return resolveEffectiveRoles(input)[0] ?? null
}

export function membershipHasEffectiveRole(
  membership: OrganizationMembership,
  predicate: (role: OrganizationRole) => boolean,
  organizationId?: string,
): boolean {
  return resolveEffectiveRolesForMembership(membership, organizationId).some(predicate)
}

export function anyMembershipHasEffectiveRole(
  memberships: OrganizationMembership[],
  predicate: (role: OrganizationRole) => boolean,
  organizationId?: string,
): boolean {
  return memberships.some((membership) =>
    membershipHasEffectiveRole(membership, predicate, organizationId),
  )
}
