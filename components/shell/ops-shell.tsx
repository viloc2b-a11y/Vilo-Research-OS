import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

type OpsShellProps = {
  children: React.ReactNode
  userEmail?: string | null
  organizationName?: string | null
}

export function OpsShell({ children, userEmail, organizationName }: OpsShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar organizationName={organizationName} />
      <div className="flex flex-1 flex-col">
        <Topbar userEmail={userEmail} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
