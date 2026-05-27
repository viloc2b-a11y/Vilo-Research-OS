import type { OrganizationMembership } from '@/lib/auth/session'
import { isOperationalMembershipStatus } from '@/lib/auth/membership-status'

export type AuthorizeRuntimeCommandInput = {
  command: string
  actorUserId: string
  organizationId: string
  memberships: OrganizationMembership[]
  targetId: string
  invocationSurface: 'api' | 'action'
}

export type AuthorizeRuntimeCommandResult =
  | { ok: true }
  | { ok: false; message: string; code?: string }

export async function authorizeRuntimeCommand(
  input: AuthorizeRuntimeCommandInput
): Promise<AuthorizeRuntimeCommandResult> {
  const membership = input.memberships.find(
    (candidate) => candidate.organization_id === input.organizationId,
  )

  if (!membership || !isOperationalMembershipStatus(membership.status)) {
    return {
      ok: false,
      message: 'You are not authorized to run this operational command.',
      code: 'unauthorized_runtime_command',
    }
  }

  return { ok: true }
}
