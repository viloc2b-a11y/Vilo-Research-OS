import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  loadRecruitmentQueue,
  loadStudyPressureCards,
  loadTodaysRecruitmentWork,
} from '@/lib/crm/recruitment-loaders'
import { RecruitmentCommandCenterShell } from '@/app/(ops)/recruitment/_components/RecruitmentCommandCenterShell'
import {
  resolveRecruitmentRoleExperience,
  toRecruitmentViewModel,
} from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { resolveEffectiveRolesForMembership } from '@/lib/rbac/effective-roles'

export default async function RecruitmentPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recruitment</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasRecruitmentAccess = canAccessPatientCRM(memberships, organizationId)
    || memberships.some((membership) =>
      membership.organization_id === organizationId &&
      (membership.role === 'site_director' || membership.roles.includes('site_director')),
    )

  if (!hasRecruitmentAccess) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recruitment</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)
  const effectiveRole = memberships
    .flatMap((membership) => resolveEffectiveRolesForMembership(membership, organizationId))
    .find((role) => role === 'owner' || role === 'admin') ??
    memberships.find((membership) => membership.organization_id === organizationId)?.role ??
    'read_only'

  const supabase = await createServerClient()
  const [todaysWork, queue, studyPressure] = await Promise.all([
    loadTodaysRecruitmentWork(supabase, organizationId, user.id),
    loadRecruitmentQueue(supabase, organizationId, user.id, effectiveRole, {
      scope: roleExperience === 'owner' ? 'all' : 'default',
    }),
    loadStudyPressureCards(supabase, organizationId),
  ])
  const model = toRecruitmentViewModel({ todaysWork, queue, studyPressure }, memberships, organizationId)

  return <RecruitmentCommandCenterShell model={model} />
}

