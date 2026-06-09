import { SidebarNav } from '@/components/shell/sidebar-nav'

type SidebarProps = {
  organizationName?: string | null
  canAccessAdmin?: boolean
  canViewFinancial?: boolean
  canAccessCoordinatorWorkspace?: boolean
  canAccessCRM?: boolean
  canAccessCommunications?: boolean
  canAccessSourceWorkflow?: boolean
  canViewVpi?: boolean
}

export function Sidebar({
  organizationName,
  canAccessAdmin,
  canViewFinancial,
  canAccessCoordinatorWorkspace,
  canAccessCRM,
  canAccessCommunications,
  canAccessSourceWorkflow,
  canViewVpi,
}: SidebarProps) {
  return (
    <SidebarNav
      organizationName={organizationName}
      canAccessAdmin={canAccessAdmin}
      canViewFinancial={canViewFinancial}
      canAccessCoordinatorWorkspace={canAccessCoordinatorWorkspace}
      canAccessCRM={canAccessCRM}
      canAccessCommunications={canAccessCommunications}
      canAccessSourceWorkflow={canAccessSourceWorkflow}
      canViewVpi={canViewVpi}
    />
  )
}
