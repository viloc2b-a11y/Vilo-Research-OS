/**
 * Runtime actor classification — fail closed when uncertain.
 */

import type { OrganizationMembership } from '@/lib/auth/session'
import { isOperationalMembershipStatus } from '@/lib/auth/membership-status'
import {
  isExternalActorOrganizationRole,
  isExternalActorStudyRole,
  isSiteInternalOrganizationRole,
} from '@/lib/rbac/external-actors'

export type RuntimeActorKind = 'internal' | 'external' | 'uncertain' | 'none'

export type RuntimeActorClassification = {
  kind: RuntimeActorKind
  /** May read raw response sets, manifest, history, projections. */
  mayAccessInternalRuntime: boolean
  /** CRA/monitor/sponsor viewer — DTO-only reads when explicitly allowed. */
  isExternalActor: boolean
}

export function isExternalActorRole(role: string): boolean {
  const normalized = role.trim().toLowerCase()
  return (
    normalized === 'cra_monitor'
    || normalized === 'external_monitor'
    || normalized === 'sponsor_viewer'
    || normalized === 'monitor'
    || normalized === 'unblinded_cra'
    || isExternalActorOrganizationRole(role)
    || isExternalActorStudyRole(role)
  )
}

function rolesForMembership(m: OrganizationMembership): string[] {
  const roles = new Set<string>()
  if (m.role?.trim()) roles.add(m.role.trim())
  for (const r of m.roles ?? []) {
    if (typeof r === 'string' && r.trim()) roles.add(r.trim())
  }
  return Array.from(roles)
}

export function classifyRuntimeActor(
  memberships: OrganizationMembership[],
  organizationId: string,
): RuntimeActorClassification {
  const orgMemberships = memberships.filter(
    (m) =>
      m.organization_id === organizationId
      && isOperationalMembershipStatus(m.status),
  )

  if (orgMemberships.length === 0) {
    return { kind: 'none', mayAccessInternalRuntime: false, isExternalActor: false }
  }

  let hasInternal = false
  let hasExternal = false

  for (const membership of orgMemberships) {
    for (const role of rolesForMembership(membership)) {
      if (isSiteInternalOrganizationRole(role)) hasInternal = true
      if (isExternalActorOrganizationRole(role)) hasExternal = true
    }
  }

  if (hasInternal) {
    return { kind: 'internal', mayAccessInternalRuntime: true, isExternalActor: false }
  }

  if (hasExternal) {
    return { kind: 'external', mayAccessInternalRuntime: false, isExternalActor: true }
  }

  return { kind: 'uncertain', mayAccessInternalRuntime: false, isExternalActor: false }
}

export function classifyActorAccess(
  memberships: OrganizationMembership[],
  organizationId: string,
): RuntimeActorClassification {
  return classifyRuntimeActor(memberships, organizationId)
}

export function assertInternalRuntimeActor(actor: RuntimeActorClassification): void {
  if (actor.kind !== 'internal' || actor.isExternalActor || !actor.mayAccessInternalRuntime) {
    throw new Error('Runtime access requires an explicit internal site role.')
  }
}
