import {
  normalizeEffectiveRoles,
  resolveEffectiveRoles,
  type MembershipRoleInput,
} from '@/lib/rbac/effective-roles'
import {
  CANONICAL_ORGANIZATION_ROLES,
  normalizeOrganizationRole,
  isUnblindedRole,
  type OrganizationRole,
} from '@/lib/rbac/roles'

export type RoleChangeContext = {
  actorUserId: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
  actorCanManageUnblinded: boolean
  targetUserId: string
  targetCurrentRoles: OrganizationRole[]
  requestedRoles: string[]
  allMembers: { userId: string; roles: OrganizationRole[] }[]
}

export type RoleChangeResult =
  | { ok: true; roles: OrganizationRole[]; primaryRole: OrganizationRole }
  | { ok: false; message: string }

export function normalizeRequestedRoles(raw: string[]): RoleChangeResult {
  const normalized = normalizeEffectiveRoles(raw)
  if (normalized.length === 0) {
    return { ok: false, message: 'At least one role is required.' }
  }
  const primaryRole = normalized[0]!
  return { ok: true, roles: normalized, primaryRole }
}

export function rolesFromMembershipRow(row: MembershipRoleInput): OrganizationRole[] {
  return resolveEffectiveRoles(row)
}

export function validateRoleChange(ctx: RoleChangeContext): RoleChangeResult {
  const parsed = normalizeRequestedRoles(ctx.requestedRoles)
  if (!parsed.ok) return parsed

  const { roles, primaryRole } = parsed
  const includesOwner = roles.includes('owner')
  const targetHadOwner = ctx.targetCurrentRoles.includes('owner')
  const actorIsTarget = ctx.actorUserId === ctx.targetUserId

  if (!ctx.actorIsAdmin) {
    return { ok: false, message: 'Admin access required.' }
  }

  // Self-promotion guard
  if (actorIsTarget) {
    const addingNewRoles = roles.some((r) => !ctx.targetCurrentRoles.includes(r))
    if (addingNewRoles) {
      return { ok: false, message: 'You cannot promote or assign yourself new roles.' }
    }
  }

  // Unblinded role escalation guard
  const includesUnblinded = roles.some(isUnblindedRole)
  const targetHadUnblinded = ctx.targetCurrentRoles.some(isUnblindedRole)

  if ((includesUnblinded || targetHadUnblinded) && !ctx.actorCanManageUnblinded) {
    return { ok: false, message: 'Only unblinded managers or owners can assign or edit unblinded roles.' }
  }

  if (includesOwner && !ctx.actorIsOwner) {
    return { ok: false, message: 'Only an owner can assign the owner role.' }
  }

  if (targetHadOwner && !includesOwner && !ctx.actorIsOwner) {
    return { ok: false, message: 'Only an owner can remove the owner role from a member.' }
  }

  const ownerCount = ctx.allMembers.filter((m) => m.roles.includes('owner')).length
  if (targetHadOwner && !includesOwner && ownerCount <= 1) {
    return { ok: false, message: 'Cannot remove the last owner from the organization.' }
  }

  const adminOrOwnerCount = ctx.allMembers.filter((m) =>
    m.roles.some((r) => r === 'owner' || r === 'admin'),
  ).length

  if (actorIsTarget) {
    const actorWillRetainAdmin =
      roles.includes('owner') || roles.includes('admin')
    const actorHadAdmin =
      ctx.targetCurrentRoles.includes('owner') ||
      ctx.targetCurrentRoles.includes('admin')
    if (actorHadAdmin && !actorWillRetainAdmin && adminOrOwnerCount <= 1) {
      return {
        ok: false,
        message: 'You cannot remove your own last owner/admin access for this organization.',
      }
    }
  }

  return { ok: true, roles, primaryRole }
}

export function assignableRolesForActor(actorIsOwner: boolean): OrganizationRole[] {
  if (actorIsOwner) return [...CANONICAL_ORGANIZATION_ROLES]
  return CANONICAL_ORGANIZATION_ROLES.filter((r) => r !== 'owner')
}

export function canActorEditTargetRoles(
  actorIsOwner: boolean,
  targetRoles: OrganizationRole[],
): boolean {
  if (targetRoles.includes('owner') && !actorIsOwner) return false
  return true
}

export function isValidStoredRole(raw: string): boolean {
  return normalizeOrganizationRole(raw) !== null || raw.trim() === 'member'
}
