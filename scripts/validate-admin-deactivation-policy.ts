/**
 * Run: npx tsx scripts/validate-admin-deactivation-policy.ts
 */
import {
  validateDeactivation,
  validateReactivation,
} from '../lib/admin/users/deactivation-policy'
import type { MemberPolicySnapshot } from '../lib/admin/users/deactivation-policy'

const ownerId = '00000000-0000-4000-8000-000000000001'
const adminId = '00000000-0000-4000-8000-000000000002'
const targetId = '00000000-0000-4000-8000-000000000003'

const members: MemberPolicySnapshot[] = [
  { userId: ownerId, roles: ['owner'], status: 'active' },
  { userId: adminId, roles: ['admin'], status: 'active' },
  { userId: targetId, roles: ['research_coordinator'], status: 'active' },
]

function assertOk(label: string, result: { ok: boolean }) {
  if (!result.ok) throw new Error(`${label}: expected ok`)
}

function assertBlocked(label: string, result: { ok: boolean }) {
  if (result.ok) throw new Error(`${label}: expected blocked`)
}

assertOk(
  'deactivate coordinator',
  validateDeactivation({
    actorUserId: adminId,
    actorIsOwner: false,
    actorIsAdmin: true,
    targetUserId: targetId,
    targetRoles: ['research_coordinator'],
    targetStatus: 'active',
    allMembers: members,
  }),
)

assertBlocked(
  'admin cannot deactivate owner',
  validateDeactivation({
    actorUserId: adminId,
    actorIsOwner: false,
    actorIsAdmin: true,
    targetUserId: ownerId,
    targetRoles: ['owner'],
    targetStatus: 'active',
    allMembers: members,
  }),
)

assertBlocked(
  'cannot deactivate last owner',
  validateDeactivation({
    actorUserId: ownerId,
    actorIsOwner: true,
    actorIsAdmin: true,
    targetUserId: ownerId,
    targetRoles: ['owner'],
    targetStatus: 'active',
    allMembers: [{ userId: ownerId, roles: ['owner'], status: 'active' }],
  }),
)

assertOk(
  'reactivate deactivated',
  validateReactivation({
    actorUserId: adminId,
    actorIsOwner: false,
    actorIsAdmin: true,
    targetUserId: targetId,
    targetRoles: ['research_coordinator'],
    targetStatus: 'deactivated',
    allMembers: members,
  }),
)

console.log('validate-admin-deactivation-policy: PASS')
