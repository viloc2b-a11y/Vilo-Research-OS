import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resolveRecruitmentRoleExperience } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { loadPartnerDetail } from '@/lib/crm/partner-management'
import { PartnerForm } from '@/components/recruitment-partners/PartnerForm'

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId } = await params

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) redirect('/recruitment/partners')

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasAccess = canAccessPatientCRM(memberships, organizationId)
  if (!hasAccess) redirect('/recruitment')

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)

  // Only owner and site_director can edit partners
  if (roleExperience === 'pi' || roleExperience === 'coordinator' || roleExperience === 'read_only') {
    redirect(`/recruitment/partners/${partnerId}`)
  }

  const supabase = await createServerClient()
  const detail = await loadPartnerDetail(supabase, organizationId, partnerId)

  if (!detail) redirect('/recruitment/partners')

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Partner Management</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Edit Partner</h1>
      </header>

      <div className="max-w-lg">
        <PartnerForm mode="edit" partner={detail} organizationId={organizationId} />
      </div>
    </div>
  )
}
