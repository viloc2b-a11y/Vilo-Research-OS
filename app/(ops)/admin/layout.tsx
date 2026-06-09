import Link from 'next/link'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { canAccessAdminSection } from '@/lib/admin/permissions'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const allowed = canAccessAdminSection(memberships)

  if (!allowed) {
    return (
      <div className="vilo-ops-scroll flex h-full min-h-0 flex-col overflow-y-auto bg-accent p-6 scrollbar-thin">
        <div className="mx-auto max-w-lg vilo-card p-6">
          <h1 className="heading-serif text-xl text-foreground">Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organization admin tools are limited to workspace owners and admins. Your account does
            not have admin access in any organization.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Back to Operations
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-accent lg:flex-row">
      <AdminSidebar />
      <div className="vilo-ops-scroll flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </div>
    </div>
  )
}
