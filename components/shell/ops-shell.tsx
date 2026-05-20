import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

type OpsShellProps = {
  children: React.ReactNode
  userEmail?: string | null
  organizationName?: string | null
}

export function OpsShell({ children, userEmail, organizationName }: OpsShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-accent">
      <Sidebar organizationName={organizationName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userEmail={userEmail} />
        {/* overflow-hidden here — each workspace page controls its own scroll via flex-col h-full */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
