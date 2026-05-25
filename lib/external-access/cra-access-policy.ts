/**
 * CRA / monitor access policy — read-only submitted source + approved evidence only.
 * No runtime intelligence, work queues, or coordinator surveillance data.
 */

import type { OrganizationMembership } from '@/lib/auth/session'
import {
  isExternalActorOrganizationRole,
  isExternalActorStudyRole,
  isSiteInternalOrganizationRole,
} from '@/lib/rbac/external-actors'
import {
  DENIED_RUNTIME_TABLES,
  type DeniedRuntimeTable,
} from '@/lib/external-access/denied-runtime-resources'

export type CraAccessContext = {
  organizationId: string
  studyId: string
  memberships: OrganizationMembership[]
  /** study_members.role when present */
  studyMemberRole?: string | null
  /** Site must enable monitor findings workflow */
  siteFindingsEnabled?: boolean
}

function hasStudyAccess(ctx: CraAccessContext): boolean {
  const inOrg = ctx.memberships.some((m) => m.organization_id === ctx.organizationId)
  if (!inOrg || !ctx.studyId.trim()) return false
  const studyRole = ctx.studyMemberRole?.trim()
  if (studyRole && isExternalActorStudyRole(studyRole)) return true
  return ctx.memberships.some(
    (m) =>
      m.organization_id === ctx.organizationId && isExternalActorOrganizationRole(m.role),
  )
}

function isExternalActor(ctx: CraAccessContext): boolean {
  if (ctx.studyMemberRole && isExternalActorStudyRole(ctx.studyMemberRole)) return true
  return ctx.memberships.some(
    (m) =>
      m.organization_id === ctx.organizationId
      && isExternalActorOrganizationRole(m.role),
  )
}

function isSiteOperator(ctx: CraAccessContext): boolean {
  return ctx.memberships.some(
    (m) =>
      m.organization_id === ctx.organizationId
      && isSiteInternalOrganizationRole(m.role),
  )
}

/** Submitted or site-approved source review (SDV). */
export function canReadSubmittedSource(ctx: CraAccessContext): boolean {
  if (!isExternalActor(ctx)) return false
  return hasStudyAccess(ctx)
}

/** Corrections/addenda/history approved for external packet. */
export function canReadSourceEvidence(ctx: CraAccessContext): boolean {
  return canReadSubmittedSource(ctx)
}

/** Findings creation when site enables inspection-readiness findings. */
export function canCreateFinding(ctx: CraAccessContext): boolean {
  if (!canReadSubmittedSource(ctx)) return false
  return ctx.siteFindingsEnabled === true
}

/** Site-approved finding responses visible to monitor. */
export function canReadFindingResponse(ctx: CraAccessContext): boolean {
  if (!canReadSubmittedSource(ctx)) return false
  return ctx.siteFindingsEnabled === true
}

/** External actors are always denied runtime intelligence surfaces. */
export function denyRuntimeIntelligenceAccess(ctx: CraAccessContext): boolean {
  return isExternalActor(ctx)
}

export type CraRuntimeAccessViolation = {
  code: 'CRA_RUNTIME_INTELLIGENCE_DENIED'
  table: DeniedRuntimeTable | string
  message: string
}

export function assertCraCannotAccessInternalRuntime(
  tableOrResource: DeniedRuntimeTable | string,
  ctx?: CraAccessContext,
): CraRuntimeAccessViolation | null {
  const denied =
    (DENIED_RUNTIME_TABLES as readonly string[]).includes(tableOrResource)
    || tableOrResource.includes('orchestration')
    || tableOrResource.includes('projection')
    || tableOrResource.includes('telemetry')
    || tableOrResource.includes('runtime_trace')
    || tableOrResource.includes('financial_runtime')
    || tableOrResource.includes('automation')

  if (!denied) return null

  if (ctx && isSiteOperator(ctx) && !isExternalActor(ctx)) {
    return null
  }

  return {
    code: 'CRA_RUNTIME_INTELLIGENCE_DENIED',
    table: tableOrResource,
    message:
      'CRA and monitor roles may only access submitted source review packets. Runtime intelligence is site-only.',
  }
}

/** Call at start of future external inspection-readiness routes. */
export function assertCraRouteContext(ctx: CraAccessContext): { ok: true } | { ok: false; message: string } {
  if (!isExternalActor(ctx)) {
    return { ok: false, message: 'External inspection routes require CRA/monitor role.' }
  }
  if (!hasStudyAccess(ctx)) {
    return { ok: false, message: 'CRA access requires study-scoped permission for this organization.' }
  }
  return { ok: true }
}

export function canAccessInternalRuntimeAsMembership(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return memberships.some(
    (m) => m.organization_id === organizationId && isSiteInternalOrganizationRole(m.role),
  )
}
