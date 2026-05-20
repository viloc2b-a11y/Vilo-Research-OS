/** Mirror of lib/rbac/effective-roles.ts for Node seeds/validators. */

const LEGACY_ROLE_NORMALIZATION = {
  member: 'research_coordinator',
}

const CANONICAL_ROLES = new Set([
  'owner',
  'admin',
  'site_staff',
  'research_coordinator',
  'data_coordinator',
  'pi_sub_i',
  'read_only',
  'unblinded_coordinator',
  'unblinded_cra',
])

export function normalizeOrganizationRole(role) {
  const trimmed = String(role ?? '').trim()
  const legacy = LEGACY_ROLE_NORMALIZATION[trimmed]
  if (legacy) return legacy
  if (CANONICAL_ROLES.has(trimmed)) return trimmed
  return null
}

export function resolveEffectiveRoles(input) {
  const fromArray = Array.isArray(input.roles) ? input.roles : []
  const fromLegacy = input.role?.trim() ? [input.role.trim()] : []
  const seen = new Set()
  const ordered = []
  for (const raw of [...fromArray, ...fromLegacy]) {
    const normalized = normalizeOrganizationRole(raw)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    ordered.push(normalized)
  }
  return ordered
}

export function anyEffectiveRole(input, predicate) {
  return resolveEffectiveRoles(input).some(predicate)
}

export function canViewUnblindedForMembership(mem) {
  return anyEffectiveRole(mem, (r) =>
    r === 'owner' || r === 'unblinded_coordinator' || r === 'unblinded_cra',
  )
}

export function canManageUnblindedForMembership(mem) {
  return anyEffectiveRole(mem, (r) => r === 'owner' || r === 'unblinded_coordinator')
}

export function canMutateForMembership(mem) {
  return anyEffectiveRole(mem, (r) => r !== 'read_only' && r !== 'unblinded_cra')
}

export function canAccessAdminForMembership(mem) {
  return anyEffectiveRole(mem, (r) => r === 'owner' || r === 'admin')
}

export function canEditClinicalSourceForMembership(mem) {
  return anyEffectiveRole(mem, (r) =>
    r === 'owner'
    || r === 'admin'
    || r === 'research_coordinator'
    || r === 'data_coordinator'
    || r === 'unblinded_coordinator'
    || r === 'pi_sub_i',
  )
}

export function canViewFinancialForMembership(mem) {
  return anyEffectiveRole(mem, (r) => r === 'owner' || r === 'admin')
}

export function canAccessCoordinatorWorkspaceForMembership(mem) {
  return anyEffectiveRole(mem, (r) =>
    r === 'owner'
    || r === 'admin'
    || r === 'site_staff'
    || r === 'research_coordinator'
    || r === 'data_coordinator'
    || r === 'unblinded_coordinator',
  )
}
