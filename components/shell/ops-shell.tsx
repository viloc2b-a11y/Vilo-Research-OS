import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

type OpsShellProps = {
  children: React.ReactNode
  userEmail?: string | null
  organizationName?: string | null
  canAccessAdmin?: boolean
  canViewFinancial?: boolean
  canAccessCoordinatorWorkspace?: boolean
  canAccessSourceWorkflow?: boolean
  canViewVpi?: boolean
}

export function OpsShell({
  children,
  userEmail,
  organizationName,
  canAccessAdmin = false,
  canViewFinancial = false,
  canAccessCoordinatorWorkspace = false,
  canAccessSourceWorkflow = false,
  canViewVpi = false,
}: OpsShellProps) {
  return (
    <div className="vilo-ops-shell flex h-screen overflow-hidden bg-accent">
      <Sidebar
        organizationName={organizationName}
        canAccessAdmin={canAccessAdmin}
        canViewFinancial={canViewFinancial}
        canAccessCoordinatorWorkspace={canAccessCoordinatorWorkspace}
        canAccessSourceWorkflow={canAccessSourceWorkflow}
        canViewVpi={canViewVpi}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar userEmail={userEmail} />
        <main className="min-h-0 flex-1 overflow-y-auto pb-24">
          {children}
        </main>
      </div>
    </div>
  )
}
