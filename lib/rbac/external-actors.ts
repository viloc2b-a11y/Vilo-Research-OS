/**
 * External actor role identifiers — CRA/monitor/sponsor viewers (not site operators).
 *
 * Policy constants; stored DB roles may use aliases until dedicated columns exist.
 * See docs/CRA_ACCESS_BOUNDARY.md.
 */

import { normalizeOrganizationRole, type OrganizationRole } from '@/lib/rbac/roles'

/** Policy-facing external monitor role ids (site-first boundary). */
export const EXTERNAL_MONITOR_ROLE = {
  CRA_MONITOR: 'cra_monitor',
  EXTERNAL_MONITOR: 'external_monitor',
  SPONSOR_VIEWER: 'sponsor_viewer',
} as const

export const EXTERNAL_MONITOR_ROLES = [
  EXTERNAL_MONITOR_ROLE.CRA_MONITOR,
  EXTERNAL_MONITOR_ROLE.EXTERNAL_MONITOR,
  EXTERNAL_MONITOR_ROLE.SPONSOR_VIEWER,
] as const

export type ExternalMonitorRole = (typeof EXTERNAL_MONITOR_ROLES)[number]

/** Study-scoped role that maps to external monitor policy. */
export const EXTERNAL_STUDY_MEMBER_ROLE = {
  MONITOR: 'monitor',
} as const

/** Org roles treated as external actors for runtime intelligence denial. */
const EXTERNAL_ORGANIZATION_ROLE_MAP: Partial<Record<OrganizationRole, ExternalMonitorRole>> = {
  unblinded_cra: EXTERNAL_MONITOR_ROLE.CRA_MONITOR,
}

const EXTERNAL_MONITOR_ROLE_SET = new Set<string>(EXTERNAL_MONITOR_ROLES)

export function isExternalMonitorRoleId(role: string): role is ExternalMonitorRole {
  return EXTERNAL_MONITOR_ROLE_SET.has(role.trim())
}

export function resolveExternalMonitorRoleFromOrganization(
  role: string,
): ExternalMonitorRole | null {
  const direct = role.trim()
  if (isExternalMonitorRoleId(direct)) return direct
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return null
  return EXTERNAL_ORGANIZATION_ROLE_MAP[normalized] ?? null
}

export function resolveExternalMonitorRoleFromStudyMember(
  studyRole: string,
): ExternalMonitorRole | null {
  const r = studyRole.trim()
  if (r === EXTERNAL_STUDY_MEMBER_ROLE.MONITOR) return EXTERNAL_MONITOR_ROLE.EXTERNAL_MONITOR
  if (isExternalMonitorRoleId(r)) return r
  return null
}

export function isExternalActorOrganizationRole(role: string): boolean {
  if (isExternalMonitorRoleId(role)) return true
  return resolveExternalMonitorRoleFromOrganization(role) !== null
}

export function isExternalActorStudyRole(studyRole: string): boolean {
  return resolveExternalMonitorRoleFromStudyMember(studyRole) !== null
}

/** Site-internal roles retain full operational runtime (coordinator-first). */
export function isSiteInternalOrganizationRole(role: string): boolean {
  if (isExternalActorOrganizationRole(role)) return false
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'site_staff'
    || normalized === 'research_coordinator'
    || normalized === 'data_coordinator'
    || normalized === 'pi_sub_i'
    || normalized === 'unblinded_coordinator'
    || normalized === 'read_only'
  )
}
