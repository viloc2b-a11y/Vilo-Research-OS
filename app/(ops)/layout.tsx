import { redirect } from 'next/navigation'
import { NoActiveOrganizationAccess } from '@/components/shell/no-active-organization-access'
import { OpsShell } from '@/components/shell/ops-shell'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessAdminSection } from '@/lib/admin/permissions'
import {
  getOrganizationMemberships,
  getSessionUser,
} from '@/lib/auth/session'
import {
  canAccessCoordinatorWorkspace,
  canPrepareSourceDrafts,
  canReviewSourceDocuments,
  canViewFinancialData,
  canViewVpi,
} from '@/lib/rbac/permissions'

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))

  if (memberships.length === 0) {
    return <NoActiveOrganizationAccess userEmail={user.email} />
  }

  const primaryOrg = memberships[0]?.organizations
  const canAccessAdmin = canAccessAdminSection(memberships)
  const canViewFinancial = canViewFinancialData(memberships)
  const canAccessCoordinator = canAccessCoordinatorWorkspace(memberships)
  const canAccessSourceWorkflow =
    canPrepareSourceDrafts(memberships) || canReviewSourceDocuments(memberships)
  const canViewVpiNav = canViewVpi(memberships)

  return (
    <OpsShell
      userEmail={user.email}
      organizationName={primaryOrg?.name ?? null}
      canAccessAdmin={canAccessAdmin}
      canViewFinancial={canViewFinancial}
      canAccessCoordinatorWorkspace={canAccessCoordinator}
      canAccessSourceWorkflow={canAccessSourceWorkflow}
      canViewVpi={canViewVpiNav}
    >
      {children}
    </OpsShell>
  )
}
