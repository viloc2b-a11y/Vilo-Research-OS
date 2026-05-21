import type { OrganizationMemberStatus } from '@/lib/admin/users/membership-status'
import type { OrganizationRole } from '@/lib/rbac/roles'

export type MemberPolicySnapshot = {
  userId: string
  roles: OrganizationRole[]
  status: OrganizationMemberStatus
}

export type DeactivationContext = {
  actorUserId: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
  targetUserId: string
  targetRoles: OrganizationRole[]
  targetStatus: OrganizationMemberStatus
  allMembers: MemberPolicySnapshot[]
}

export type PolicyResult = { ok: true } | { ok: false; message: string }

function activeAdminOrOwnerCount(members: MemberPolicySnapshot[]): number {
  return members.filter(
    (m) =>
      m.status !== 'deactivated' &&
      m.roles.some((r) => r === 'owner' || r === 'admin'),
  ).length
}

function activeOwnerCount(members: MemberPolicySnapshot[]): number {
  return members.filter(
    (m) => m.status !== 'deactivated' && m.roles.includes('owner'),
  ).length
}

export function validateDeactivation(ctx: DeactivationContext): PolicyResult {
  if (!ctx.actorIsAdmin) {
    return { ok: false, message: 'Admin access required.' }
  }

  if (ctx.targetStatus === 'deactivated') {
    return { ok: false, message: 'This member is already deactivated.' }
  }

  const targetIsOwner = ctx.targetRoles.includes('owner')

  if (targetIsOwner && !ctx.actorIsOwner) {
    return { ok: false, message: 'Only an owner can deactivate another owner.' }
  }

  if (targetIsOwner && activeOwnerCount(ctx.allMembers) <= 1) {
    return { ok: false, message: 'Cannot deactivate the last active owner for this organization.' }
  }

  const actorIsTarget = ctx.actorUserId === ctx.targetUserId
  if (actorIsTarget) {
    const actorHadAdmin =
      ctx.targetRoles.includes('owner') || ctx.targetRoles.includes('admin')
    if (actorHadAdmin && activeAdminOrOwnerCount(ctx.allMembers) <= 1) {
      return {
        ok: false,
        message:
          'You cannot deactivate yourself while you are the last active owner or admin.',
      }
    }
  }

  return { ok: true }
}

export function validateReactivation(ctx: DeactivationContext): PolicyResult {
  if (!ctx.actorIsAdmin) {
    return { ok: false, message: 'Admin access required.' }
  }

  if (ctx.targetStatus !== 'deactivated') {
    return { ok: false, message: 'Only deactivated members can be reactivated.' }
  }

  return { ok: true }
}
