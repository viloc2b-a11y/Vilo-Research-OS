/**
 * Validates admin role-policy rules (no DB).
 * Run: npx tsx scripts/validate-admin-role-policy.ts
 */
import { validateRoleChange } from '../lib/admin/users/role-policy'

const ownerId = '00000000-0000-4000-8000-000000000001'
const adminId = '00000000-0000-4000-8000-000000000002'
const targetId = '00000000-0000-4000-8000-000000000003'

function assert(label: string, result: { ok: boolean; message?: string }) {
  if (!result.ok) throw new Error(`${label}: expected ok, got ${result.message}`)
}

function assertBlocked(label: string, result: { ok: boolean; message?: string }) {
  if (result.ok) throw new Error(`${label}: expected blocked`)
}

const members = [
  { userId: ownerId, roles: ['owner'] as const },
  { userId: adminId, roles: ['admin'] as const },
  { userId: targetId, roles: ['research_coordinator'] as const },
]

assert('research + data', validateRoleChange({
  actorUserId: adminId,
  actorIsOwner: false,
  actorIsAdmin: true,
  actorCanManageUnblinded: false,
  targetUserId: targetId,
  targetCurrentRoles: ['research_coordinator'],
  requestedRoles: ['research_coordinator', 'data_coordinator'],
  allMembers: members.map((m) => ({ userId: m.userId, roles: [...m.roles] })),
}))

assertBlocked('admin without unblinded cannot assign unblinded', validateRoleChange({
  actorUserId: adminId,
  actorIsOwner: false,
  actorIsAdmin: true,
  actorCanManageUnblinded: false,
  targetUserId: targetId,
  targetCurrentRoles: ['research_coordinator'],
  requestedRoles: ['unblinded_coordinator', 'data_coordinator'],
  allMembers: members.map((m) => ({ userId: m.userId, roles: [...m.roles] })),
}))

assert('admin with unblinded can assign unblinded', validateRoleChange({
  actorUserId: adminId,
  actorIsOwner: false,
  actorIsAdmin: true,
  actorCanManageUnblinded: true,
  targetUserId: targetId,
  targetCurrentRoles: ['research_coordinator'],
  requestedRoles: ['unblinded_coordinator', 'data_coordinator'],
  allMembers: members.map((m) => ({ userId: m.userId, roles: [...m.roles] })),
}))

assertBlocked('admin cannot assign owner', validateRoleChange({
  actorUserId: adminId,
  actorIsOwner: false,
  actorIsAdmin: true,
  actorCanManageUnblinded: false,
  targetUserId: targetId,
  targetCurrentRoles: ['research_coordinator'],
  requestedRoles: ['owner', 'admin'],
  allMembers: members.map((m) => ({ userId: m.userId, roles: [...m.roles] })),
}))

console.log('validate-admin-role-policy: PASS')
