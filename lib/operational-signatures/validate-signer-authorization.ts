import type { OrganizationMembership } from '@/lib/auth/session'
import { resolveEffectiveRolesForMembership } from '@/lib/rbac/effective-roles'
import {
  normalizeOrganizationRole,
  type OrganizationRole,
} from '@/lib/rbac/roles'

export type SignerAuthorizationResult =
  | {
      ok: true
      signerRole: OrganizationRole
      requiredRole: OrganizationRole
      delegationMatched: boolean
    }
  | {
      ok: false
      reason: string
      requiredRole: OrganizationRole | null
      signerRoles: OrganizationRole[]
    }

export function normalizeRequiredSignatureRole(role: string): OrganizationRole | null {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const aliases: Record<string, OrganizationRole> = {
    pi: 'pi_sub_i',
    sub_i: 'pi_sub_i',
    subi: 'pi_sub_i',
    si: 'pi_sub_i',
    investigator: 'pi_sub_i',
    coordinator: 'research_coordinator',
    crc: 'research_coordinator',
  }
  return aliases[normalized] ?? normalizeOrganizationRole(normalized)
}

export function validateSignerAuthorization({
  memberships,
  organizationId,
  requiredRole,
}: {
  memberships: OrganizationMembership[]
  organizationId: string
  requiredRole: string
}): SignerAuthorizationResult {
  const normalizedRequired = normalizeRequiredSignatureRole(requiredRole)
  const signerRoles = [
    ...new Set(
      memberships.flatMap((membership) =>
        resolveEffectiveRolesForMembership(membership, organizationId),
      ),
    ),
  ]

  if (!normalizedRequired) {
    return {
      ok: false,
      reason: 'Required role is not a recognized operational role.',
      requiredRole: null,
      signerRoles,
    }
  }

  const exactRole = signerRoles.find((role) => role === normalizedRequired)
  if (exactRole) {
    return {
      ok: true,
      signerRole: exactRole,
      requiredRole: normalizedRequired,
      delegationMatched: false,
    }
  }

  // TODO: Wire to explicit delegation assignment table before allowing delegated signatures.

  return {
    ok: false,
    reason: 'Signer role does not match the required role and no valid delegation is available.',
    requiredRole: normalizedRequired,
    signerRoles,
  }
}
