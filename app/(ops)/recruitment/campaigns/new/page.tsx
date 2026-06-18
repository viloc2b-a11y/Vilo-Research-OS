import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { resolveRecruitmentRoleExperience } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { CampaignForm } from '@/components/recruitment-campaigns/CampaignForm'

export default async function NewCampaignPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New Campaign</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasAccess = canAccessPatientCRM(memberships, organizationId)
  if (!hasAccess) redirect('/recruitment')

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)

  // Only owner and site_director can create campaigns
  if (roleExperience === 'pi' || roleExperience === 'coordinator') {
    redirect('/recruitment/campaigns')
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Campaign Management</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">New Campaign</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create a new recruitment campaign to track patient lead acquisition.
        </p>
      </header>
      <CampaignForm mode="create" organizationId={organizationId} />
    </div>
  )
}
