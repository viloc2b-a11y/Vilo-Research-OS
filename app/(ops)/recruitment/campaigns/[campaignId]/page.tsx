import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resolveRecruitmentRoleExperience } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { loadCampaignDetail } from '@/lib/crm/campaign-management'
import { CampaignStatusBadge } from '@/components/recruitment-campaigns/CampaignStatusBadge'
import { CampaignTypeBadge } from '@/components/recruitment-campaigns/CampaignTypeBadge'
import { CampaignPerformanceSummary } from '@/components/recruitment-campaigns/CampaignPerformanceSummary'
import { CampaignStudyAssignments } from '@/components/recruitment-campaigns/CampaignStudyAssignments'
import { CampaignAttributionSnapshot } from '@/components/recruitment-campaigns/CampaignAttributionSnapshot'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await params

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Campaign</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasAccess = canAccessPatientCRM(memberships, organizationId)
  if (!hasAccess) redirect('/recruitment')

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)

  // PI → no access
  if (roleExperience === 'pi') redirect('/recruitment')

  const canManage = roleExperience === 'owner' || roleExperience === 'site_director'

  const supabase = await createServerClient()
  const detail = await loadCampaignDetail(supabase, organizationId, campaignId)

  if (!detail) {
    return (
      <div className="space-y-3 p-6">
        <Link href="/recruitment/campaigns" className="text-sm text-teal-700 hover:underline">
          ← Campaigns
        </Link>
        <p className="text-sm text-slate-500">Campaign not found or access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/recruitment" className="hover:text-slate-700 hover:underline">
          Recruitment
        </Link>
        <span>/</span>
        <Link href="/recruitment/campaigns" className="hover:text-slate-700 hover:underline">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-slate-900">{detail.name}</span>
      </nav>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CampaignStatusBadge status={detail.status} />
            <CampaignTypeBadge type={detail.campaign_type} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{detail.name}</h1>
          {detail.description && (
            <p className="mt-1 text-sm text-slate-600">{detail.description}</p>
          )}
        </div>
        {canManage && (
          <Link
            href={`/recruitment/campaigns/${detail.id}/edit`}
            className="inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Edit
          </Link>
        )}
      </header>

      {/* Performance summary */}
      <CampaignPerformanceSummary detail={detail} canViewBudget={canManage} />

      {/* Study assignments */}
      <CampaignStudyAssignments
        detail={detail}
        canManage={canManage}
        organizationId={organizationId}
      />

      {/* Attribution snapshot */}
      <CampaignAttributionSnapshot detail={detail} />
    </div>
  )
}
