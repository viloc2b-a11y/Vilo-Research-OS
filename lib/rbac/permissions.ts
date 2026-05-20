import type { OrganizationMembership } from '@/lib/auth/session'
import {
  anyMembershipHasEffectiveRole,
  resolveEffectiveRolesForMembership,
} from '@/lib/rbac/effective-roles'
import { canViewUnblindedData } from '@/lib/rbac/unblinded-access'
import {
  isOrganizationAdmin,
  isOrganizationOwner,
  normalizeOrganizationRole,
  type OrganizationRole,
} from '@/lib/rbac/roles'

function anyMembershipMatches(
  memberships: OrganizationMembership[],
  predicate: (role: OrganizationRole) => boolean,
  organizationId?: string,
): boolean {
  return anyMembershipHasEffectiveRole(memberships, predicate, organizationId)
}

// ---------------------------------------------------------------------------
// Admin hub & site administration
// ---------------------------------------------------------------------------

export function canAccessAdminSectionForRole(role: string): boolean {
  return isOrganizationAdmin(role)
}

export function canAccessAdminSection(memberships: OrganizationMembership[]): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationAdmin(role))
}

export function canManageUsersForRole(role: string): boolean {
  return isOrganizationAdmin(role)
}

export function canManageUsers(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationAdmin(role), organizationId)
}

export function canPerformOwnershipCriticalActionsForRole(role: string): boolean {
  return isOrganizationOwner(role)
}

export function canPerformOwnershipCriticalActions(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationOwner(role), organizationId)
}

// ---------------------------------------------------------------------------
// Studies, templates, coordinator workspace
// ---------------------------------------------------------------------------

export function canManageStudiesForRole(role: string): boolean {
  return isOrganizationAdmin(role)
}

export function canManageStudies(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationAdmin(role), organizationId)
}

export function canManageTemplatesForRole(role: string): boolean {
  return isOrganizationAdmin(role)
}

export function canManageTemplates(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationAdmin(role), organizationId)
}

export function canAccessCoordinatorWorkspaceForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'site_staff'
    || normalized === 'research_coordinator'
    || normalized === 'data_coordinator'
    || normalized === 'unblinded_coordinator'
  )
}

export function canAccessCoordinatorWorkspace(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canAccessCoordinatorWorkspaceForRole(role),
    organizationId,
  )
}

/** Schedule/reschedule visits and calendar visit mutations (not source-only visit read). */
export function canManageSubjectVisitsForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'research_coordinator'
    || normalized === 'unblinded_coordinator'
  )
}

/** Open visit workspace and source capture on a subject visit (limited vs manage). */
export function canAccessSubjectVisitWorkspaceForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'site_staff'
    || normalized === 'research_coordinator'
    || normalized === 'data_coordinator'
    || normalized === 'unblinded_coordinator'
    || normalized === 'pi_sub_i'
  )
}

export function canAccessSubjectVisitWorkspace(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canAccessSubjectVisitWorkspaceForRole(role),
    organizationId,
  )
}

export function canManageSubjectVisits(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canManageSubjectVisitsForRole(role),
    organizationId,
  )
}

// ---------------------------------------------------------------------------
// Clinical source & investigator actions
// ---------------------------------------------------------------------------

export function canEditClinicalSourceForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'research_coordinator'
    || normalized === 'data_coordinator'
    || normalized === 'unblinded_coordinator'
    || normalized === 'pi_sub_i'
  )
}

export function canEditClinicalSource(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canEditClinicalSourceForRole(role),
    organizationId,
  )
}

export function canSignClinicalSourceForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'pi_sub_i'
  )
}

export function canSignClinicalSource(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canSignClinicalSourceForRole(role),
    organizationId,
  )
}

export function canManageSourceDocumentsForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'research_coordinator'
    || normalized === 'data_coordinator'
    || normalized === 'unblinded_coordinator'
  )
}

export function canManageSourceDocuments(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canManageSourceDocumentsForRole(role),
    organizationId,
  )
}

export function canPrepareSourceDraftsForRole(role: string): boolean {
  return canManageSourceDocumentsForRole(role)
}

export function canPrepareSourceDrafts(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canPrepareSourceDraftsForRole(role),
    organizationId,
  )
}

export function canReviewSourceDocumentsForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'data_coordinator'
    || normalized === 'pi_sub_i'
    || normalized === 'unblinded_cra'
  )
}

export function canReviewSourceDocuments(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canReviewSourceDocumentsForRole(role),
    organizationId,
  )
}

export function canAccessSourceCaptureForRole(role: string): boolean {
  return (
    canManageSourceDocumentsForRole(role)
    || canReviewSourceDocumentsForRole(role)
    || canEditClinicalSourceForRole(role)
  )
}

export function canAccessSourceCapture(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canAccessSourceCaptureForRole(role),
    organizationId,
  )
}

export {
  canViewUnblindedData,
  canViewUnblindedDataForRole,
} from '@/lib/rbac/unblinded-access'

// ---------------------------------------------------------------------------
// Unblinded access (treatment / IP / randomization-sensitive)
// ---------------------------------------------------------------------------

/** Create/update unblinded operational records, calendar items, and assignments. */
export function canManageUnblindedDataForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return normalized === 'owner' || normalized === 'unblinded_coordinator'
}

export function canManageUnblindedData(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canManageUnblindedDataForRole(role),
    organizationId,
  )
}

/** Sponsor/CRO monitor — read unblinded audit data; no site admin or user management. */
export function canMonitorUnblindedDataForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'unblinded_cra'
    || normalized === 'unblinded_coordinator'
  )
}

export function canMonitorUnblindedData(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canMonitorUnblindedDataForRole(role),
    organizationId,
  )
}

// ---------------------------------------------------------------------------
// Financial access
// ---------------------------------------------------------------------------

export function canViewFinancialDataForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return normalized === 'owner' || normalized === 'admin'
}

export function canViewFinancialData(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canViewFinancialDataForRole(role),
    organizationId,
  )
}

// ---------------------------------------------------------------------------
// Reporting & read-only
// ---------------------------------------------------------------------------

export function canViewReportsForRole(role: string): boolean {
  return normalizeOrganizationRole(role) !== null
}

export function canViewReports(memberships: OrganizationMembership[]): boolean {
  return anyMembershipMatches(memberships, (role) => canViewReportsForRole(role))
}

export function canViewVpiForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return (
    normalized === 'owner'
    || normalized === 'admin'
    || normalized === 'site_staff'
    || normalized === 'research_coordinator'
    || normalized === 'unblinded_coordinator'
  )
}

export function canViewVpi(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => canViewVpiForRole(role), organizationId)
}

export function canMutateOrganizationDataForRole(role: string): boolean {
  const normalized = normalizeOrganizationRole(role)
  if (!normalized) return false
  return normalized !== 'read_only' && normalized !== 'unblinded_cra'
}

export function canMutateOrganizationData(
  memberships: OrganizationMembership[],
  organizationId?: string,
): boolean {
  return anyMembershipMatches(
    memberships,
    (role) => canMutateOrganizationDataForRole(role),
    organizationId,
  )
}

// ---------------------------------------------------------------------------
// Membership summaries
// ---------------------------------------------------------------------------

export function membershipsWithSiteAdminAccess(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return memberships.filter((membership) =>
    anyMembershipHasEffectiveRole([membership], (role) => isOrganizationAdmin(role)),
  )
}

export function hasSiteAdminAccess(
  memberships: OrganizationMembership[],
  organizationId: string,
): boolean {
  return anyMembershipMatches(memberships, (role) => isOrganizationAdmin(role), organizationId)
}

export function siteAdminOrganizationSummaries(memberships: OrganizationMembership[]): {
  id: string
  name: string
  role: string
  normalizedRole: OrganizationRole
}[] {
  return membershipsWithSiteAdminAccess(memberships).map((membership) => {
    const adminRole = resolveEffectiveRolesForMembership(membership).find((role) =>
      isOrganizationAdmin(role),
    )
    return {
      id: membership.organization_id,
      name: membership.organizations?.name ?? membership.organization_id,
      role: membership.role,
      normalizedRole: adminRole!,
    }
  })
}

export type SitePermissionSnapshot = {
  effectiveRoles: OrganizationRole[]
  canAccessAdmin: boolean
  canManageUsers: boolean
  canManageStudies: boolean
  canAccessCoordinatorWorkspace: boolean
  canAccessSubjectVisitWorkspace: boolean
  canManageSubjectVisits: boolean
  canManageSourceDocuments: boolean
  canReviewSourceDocuments: boolean
  canPrepareSourceDrafts: boolean
  canAccessSourceCapture: boolean
  canEditClinicalSource: boolean
  canSignClinicalSource: boolean
  canViewReports: boolean
  canViewFinancial: boolean
  canViewVpi: boolean
  canViewUnblinded: boolean
  canManageUnblinded: boolean
  canMonitorUnblinded: boolean
  canMutate: boolean
}

export function resolveSitePermissions(
  memberships: OrganizationMembership[],
  organizationId?: string,
): SitePermissionSnapshot {
  const effectiveRoles = [
    ...new Set(
      memberships.flatMap((m) => resolveEffectiveRolesForMembership(m, organizationId)),
    ),
  ]

  return {
    effectiveRoles,
    canAccessAdmin: canAccessAdminSection(memberships),
    canManageUsers: canManageUsers(memberships, organizationId),
    canManageStudies: canManageStudies(memberships, organizationId),
    canAccessCoordinatorWorkspace: canAccessCoordinatorWorkspace(memberships, organizationId),
    canAccessSubjectVisitWorkspace: canAccessSubjectVisitWorkspace(memberships, organizationId),
    canManageSubjectVisits: canManageSubjectVisits(memberships, organizationId),
    canManageSourceDocuments: canManageSourceDocuments(memberships, organizationId),
    canReviewSourceDocuments: canReviewSourceDocuments(memberships, organizationId),
    canPrepareSourceDrafts: canPrepareSourceDrafts(memberships, organizationId),
    canAccessSourceCapture: canAccessSourceCapture(memberships, organizationId),
    canEditClinicalSource: canEditClinicalSource(memberships, organizationId),
    canSignClinicalSource: canSignClinicalSource(memberships, organizationId),
    canViewReports: canViewReports(memberships),
    canViewFinancial: canViewFinancialData(memberships, organizationId),
    canViewVpi: canViewVpi(memberships, organizationId),
    canViewUnblinded: canViewUnblindedData(memberships, organizationId),
    canManageUnblinded: canManageUnblindedData(memberships, organizationId),
    canMonitorUnblinded: canMonitorUnblindedData(memberships, organizationId),
    canMutate: canMutateOrganizationData(memberships, organizationId),
  }
}
