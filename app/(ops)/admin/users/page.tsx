import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddMemberForm } from '@/components/admin/users/add-member-form'
import { OrganizationMemberTable } from '@/components/admin/users/organization-member-table'
import { RoleMatrixHelp } from '@/components/admin/users/role-matrix-help'
import { adminUsersPath } from '@/lib/ops/paths'
import { canAccessAdminSection } from '@/lib/admin/permissions'
import {
  adminOrganizationsForUser,
  loadOrganizationMembersAdmin,
} from '@/lib/admin/users/load-organization-members'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'

type AdminUsersPageProps = {
  searchParams: Promise<{ organization_id?: string }>
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const { organization_id: orgParam } = await searchParams
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []

  if (!canAccessAdminSection(memberships)) {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-accent p-6 scrollbar-thin">
        <div className="mx-auto max-w-lg vilo-card p-6">
          <h1 className="heading-serif text-xl text-foreground">Team / Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organization user management is limited to workspace owners and admins.
          </p>
          <Link href="/admin" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Back to Admin
          </Link>
        </div>
      </div>
    )
  }

  const orgOptions = adminOrganizationsForUser(memberships)
  const organizationId = orgParam ?? orgOptions[0]?.id

  if (!organizationId || !orgOptions.some((o) => o.id === organizationId)) {
    notFound()
  }

  const loaded = await loadOrganizationMembersAdmin(organizationId)
  if (!loaded.ok) {
    if (loaded.reason === 'forbidden' || loaded.reason === 'unauthorized') {
      notFound()
    }
    notFound()
  }

  const { model } = loaded

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-accent scrollbar-thin">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin
            </p>
            <h1 className="heading-serif text-xl text-foreground">Team / Users</h1>
            <p className="text-sm text-muted-foreground">
              {model.organizationName} — assign site roles and multi-role permissions.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
            ← Admin hub
          </Link>
        </div>

        {orgOptions.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {orgOptions.map((org) => (
              <Link
                key={org.id}
                href={adminUsersPath(org.id)}
                className={
                  org.id === organizationId
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                    : 'rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
                }
              >
                {org.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-6 p-6">
        <AddMemberForm
          organizationId={model.organizationId}
          actorIsOwner={model.actorIsOwner}
          inviteSupported={model.inviteSupported}
        />
        <OrganizationMemberTable model={model} />
        <RoleMatrixHelp />
      </div>
    </div>
  )
}
