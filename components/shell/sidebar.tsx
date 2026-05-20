import { SidebarNav } from '@/components/shell/sidebar-nav'

type SidebarProps = {
  organizationName?: string | null
  canAccessAdmin?: boolean
  canViewFinancial?: boolean
  canAccessCoordinatorWorkspace?: boolean
  canAccessSourceWorkflow?: boolean
  canViewVpi?: boolean
}

export function Sidebar({
  organizationName,
  canAccessAdmin,
  canViewFinancial,
  canAccessCoordinatorWorkspace,
  canAccessSourceWorkflow,
  canViewVpi,
}: SidebarProps) {
  return (
    <SidebarNav
      organizationName={organizationName}
      canAccessAdmin={canAccessAdmin}
      canViewFinancial={canViewFinancial}
      canAccessCoordinatorWorkspace={canAccessCoordinatorWorkspace}
      canAccessSourceWorkflow={canAccessSourceWorkflow}
      canViewVpi={canViewVpi}
    />
  )
}
