import Link from 'next/link'
import { CreateStudyForm } from '@/components/studies/create-study-form'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { orgAdminOrganizations } from '@/lib/studies/permissions'

export default async function NewStudyPage() {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const adminMemberships = orgAdminOrganizations(memberships)
  const defaultOrganizationId = user ? await getPrimaryOrganizationId(user.id) : null

  const organizations = adminMemberships.map((m) => ({
    organizationId: m.organization_id,
    organizationName: m.organizations?.name ?? m.organization_id,
  }))

  if (organizations.length === 0) {
    return (
      <CoordinatorPageScroll contentClassName="p-6 pb-24">
        <div className="max-w-lg">
          <h1 className="heading-serif text-xl text-foreground">New Study</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Only organization owners or admins can create studies. Ask your workspace admin to grant
            admin access, or use an account with owner/admin role.
          </p>
          <Link href="/studies" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
            Back to Studies
          </Link>
        </div>
      </CoordinatorPageScroll>
    )
  }

  const defaultOrg =
    organizations.find((o) => o.organizationId === defaultOrganizationId)?.organizationId ??
    organizations[0]?.organizationId ??
    null

  return (
    <CoordinatorPageScroll contentClassName="p-6 pb-24">
      <CreateStudyForm organizations={organizations} defaultOrganizationId={defaultOrg} />
    </CoordinatorPageScroll>
  )
}
