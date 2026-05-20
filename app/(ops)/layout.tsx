import { redirect } from 'next/navigation'
import { OpsShell } from '@/components/shell/ops-shell'
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

  const memberships = await getOrganizationMemberships(user.id)
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
