import Link from 'next/link'
import { CreateStudyForm } from '@/components/studies/create-study-form'
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
      <div className="p-6 max-w-lg">
        <h1 className="heading-serif text-xl text-[#10253e]">New Study</h1>
        <p className="text-sm text-[#98a5ad] mt-2">
          Only organization owners or admins can create studies. Ask your workspace admin to grant
          admin access, or use an account with owner/admin role.
        </p>
        <Link href="/studies" className="inline-block mt-4 text-sm font-medium text-[#34a090] hover:underline">
          Back to Studies
        </Link>
      </div>
    )
  }

  const defaultOrg =
    organizations.find((o) => o.organizationId === defaultOrganizationId)?.organizationId ??
    organizations[0]?.organizationId ??
    null

  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin" style={{ backgroundColor: '#f9f8f7' }}>
      <CreateStudyForm organizations={organizations} defaultOrganizationId={defaultOrg} />
    </div>
  )
}
