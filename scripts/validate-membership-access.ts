/**
 * Run: npx tsx scripts/validate-membership-access.ts
 */
import { activeMemberships } from '../lib/auth/membership-access'
import {
  isOperationalMembershipStatus,
  normalizeMembershipStatus,
} from '../lib/auth/membership-status'
import type { OrganizationMembership } from '../lib/auth/session'
import { canAccessAdminSection } from '../lib/rbac/permissions'

function membership(
  status: string | null,
  role: string,
): OrganizationMembership {
  return {
    organization_id: 'org-1',
    role,
    roles: [role],
    status: normalizeMembershipStatus(status),
    organizations: { id: 'org-1', name: 'Test Org' },
  }
}

if (!isOperationalMembershipStatus(null)) throw new Error('null should be operational')
if (!isOperationalMembershipStatus('active')) throw new Error('active should be operational')
if (isOperationalMembershipStatus('deactivated')) throw new Error('deactivated must not be operational')
if (isOperationalMembershipStatus('inactive')) throw new Error('inactive must not be operational')

const all = [
  membership('deactivated', 'admin'),
  membership('active', 'research_coordinator'),
]
const active = activeMemberships(all)
if (active.length !== 1) throw new Error('activeMemberships should keep one row')
if (canAccessAdminSection([membership('deactivated', 'admin')])) {
  throw new Error('deactivated admin must not grant admin nav')
}

console.log('validate-membership-access: PASS')
