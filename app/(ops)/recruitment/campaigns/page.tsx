import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resolveRecruitmentRoleExperience } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { loadCampaignList, type CampaignStatus } from '@/lib/crm/campaign-management'
import { CampaignListTable } from '@/components/recruitment-campaigns/CampaignListTable'

const STATUS_TABS: { label: string; value: CampaignStatus | 'all' }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
]

export default async function CampaignListPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const params = (await searchParams) ?? {}
  const statusParam = (params.status ?? 'active') as CampaignStatus | 'all'

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Campaign Management</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasAccess = canAccessPatientCRM(memberships, organizationId)
  if (!hasAccess) redirect('/recruitment')

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)

  // PI → no access to campaign management
  if (roleExperience === 'pi') redirect('/recruitment')

  const canManage = roleExperience === 'owner' || roleExperience === 'site_director'

  const supabase = await createServerClient()
  const campaigns = await loadCampaignList(supabase, organizationId, statusParam)

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Patient Acquisition</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Campaign Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track and manage recruitment campaigns that drive patient lead generation.
        </p>
      </header>

      {/* Status filter tabs */}
      <nav className="flex gap-1 border-b border-slate-200">
        {STATUS_TABS.map((tab) => {
          const isActive = statusParam === tab.value
          return (
            <a
              key={tab.value}
              href={`/recruitment/campaigns?status=${tab.value}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-teal-700 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </a>
          )
        })}
      </nav>

      <CampaignListTable campaigns={campaigns} canManage={canManage} />
    </div>
  )
}
