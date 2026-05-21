import {
  validateDeactivation,
  validateReactivation,
  type MemberPolicySnapshot,
} from '@/lib/admin/users/deactivation-policy'
import type { OrganizationMemberStatus } from '@/lib/admin/users/membership-status'
import type { OrganizationRole } from '@/lib/rbac/roles'

export function canActorDeactivateTarget(input: {
  actorUserId: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
  targetUserId: string
  targetRoles: OrganizationRole[]
  targetStatus: OrganizationMemberStatus
  allMembers: MemberPolicySnapshot[]
}): boolean {
  return validateDeactivation({
    actorUserId: input.actorUserId,
    actorIsOwner: input.actorIsOwner,
    actorIsAdmin: input.actorIsAdmin,
    targetUserId: input.targetUserId,
    targetRoles: input.targetRoles,
    targetStatus: input.targetStatus,
    allMembers: input.allMembers,
  }).ok
}

export function canActorReactivateTarget(input: {
  actorIsAdmin: boolean
  targetStatus: OrganizationMemberStatus
}): boolean {
  return validateReactivation({
    actorUserId: '',
    actorIsOwner: false,
    actorIsAdmin: input.actorIsAdmin,
    targetUserId: '',
    targetRoles: [],
    targetStatus: input.targetStatus,
    allMembers: [],
  }).ok
}
