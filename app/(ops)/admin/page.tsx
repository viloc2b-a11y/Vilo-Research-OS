import Link from 'next/link'
import { AdminHubCards } from '@/components/admin/admin-hub-cards'
import {
  adminOrganizationSummaries,
  canAccessAdminSection,
} from '@/lib/admin/permissions'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'

export default async function AdminPage() {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const allowed = canAccessAdminSection(memberships)
  const organizations = adminOrganizationSummaries(memberships)

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
    <div className="vilo-ops-scroll flex h-full min-h-0 flex-col overflow-y-auto bg-accent scrollbar-thin">
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="heading-serif text-xl text-foreground">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Organization administration — link-through to active workspaces only.
        </p>
      </div>
      <div className="p-6">
        <AdminHubCards organizations={organizations} />
      </div>
    </div>
  )
}
