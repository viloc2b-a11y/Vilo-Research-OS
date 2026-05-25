/**
 * Site-level roles on public.organization_members.
 *
 * Legacy `role` column plus `roles text[]` for multi-role memberships.
 * Effective permissions = union of all roles (see lib/rbac/effective-roles.ts).
 *
 * Organization-scoped (not study_members). Study-scoped roles remain on study_members.
 */

export const CANONICAL_ORGANIZATION_ROLES = [
  'owner',
  'admin',
  'site_staff',
  'research_coordinator',
  'data_coordinator',
  'pi_sub_i',
  'read_only',
  'unblinded_coordinator',
  'unblinded_cra',
] as const

export const LEGACY_ORGANIZATION_ROLE = 'member' as const

export const STORED_ORGANIZATION_ROLES = [
  ...CANONICAL_ORGANIZATION_ROLES,
  LEGACY_ORGANIZATION_ROLE,
] as const

/** @deprecated Prefer CANONICAL_ORGANIZATION_ROLES */
export const ORGANIZATION_ROLES = CANONICAL_ORGANIZATION_ROLES

export type OrganizationRole = (typeof CANONICAL_ORGANIZATION_ROLES)[number]
export type StoredOrganizationRole = (typeof STORED_ORGANIZATION_ROLES)[number]

/**
 * Role intent:
 *
 * owner — Full org control including ownership-critical actions and unblinded access.
 *
 * admin — Site administration (users, studies, templates, calendar settings). No automatic
 *   unblinded access unless explicitly granted a separate unblinded role later.
 *
 * site_staff — General site ops; blinded operational views; limited writes.
 *
 * research_coordinator — Blinded coordinator: visits, source, con meds, calendar; no
 *   treatment arm, IP allocation, or unblinded notes.
 *
 * data_coordinator — Blinded eSource/data specialist: source document prep/review, draft
 *   workflows, data quality; coordinator workspace and visit read/capture access; no admin,
 *   PI sign-off, unblinded fields, IP/randomization, or financial access.
 *
 * pi_sub_i — Investigator review/sign; blinded clinical views unless explicitly unblinded.
 *
 * read_only — View-only for data permitted by RLS and blinding filters.
 *
 * unblinded_coordinator — Unblinded operational access when assigned; coordinator workflows
 *   plus treatment/IP-sensitive fields and unblinded calendar items.
 *
 * unblinded_cra — Sponsor/CRO monitor: unblinded review/audit only; no site admin or
 *   general user management. Maps to policy role cra_monitor (see lib/rbac/external-actors.ts).
 *
 * Policy-only external aliases (study_members or future org roles):
 *   cra_monitor, external_monitor (study role monitor), sponsor_viewer — external actors;
 *   no runtime intelligence; see docs/CRA_ACCESS_BOUNDARY.md.
 */

const LEGACY_ROLE_NORMALIZATION: Record<string, OrganizationRole> = {
  [LEGACY_ORGANIZATION_ROLE]: 'research_coordinator',
}

export function normalizeOrganizationRole(role: string): OrganizationRole | null {
  const trimmed = role.trim()
  const legacy = LEGACY_ROLE_NORMALIZATION[trimmed]
  if (legacy) return legacy
  if ((CANONICAL_ORGANIZATION_ROLES as readonly string[]).includes(trimmed)) {
    return trimmed as OrganizationRole
  }
  return null
}

export function isStoredOrganizationRole(role: string): role is StoredOrganizationRole {
  return (STORED_ORGANIZATION_ROLES as readonly string[]).includes(role.trim())
}

export function isOrganizationOwner(role: string): boolean {
  return normalizeOrganizationRole(role) === 'owner'
}

export function isOrganizationAdmin(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  return normalized === 'owner' || normalized === 'admin'
}

export function isUnblindedRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  return normalized === 'unblinded_coordinator' || normalized === 'unblinded_cra'
}

export function isReadOnlyOrganizationRole(role: string): boolean {
  return normalizeOrganizationRole(role) === 'read_only'
}

export function isDataCoordinatorRole(role: string): boolean {
  return normalizeOrganizationRole(role) === 'data_coordinator'
}
