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
import { loadRecruitmentFunnelSummary, loadSourceEffectiveness } from '@/lib/crm/recruitment-intelligence'
import { loadCoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'
import { loadRecruitmentForecastForStudy } from '@/lib/crm/recruitment-forecast'
import { computeSiteBenchmarkValues } from '@/lib/benchmarking/site-benchmark-compute'

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string | string[]; reason?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const result = Array.isArray(params.result) ? params.result[0] : params.result
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason

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

  const isOwnerOrDirector =
    roleExperience === 'owner' || roleExperience === 'site_director'

  // Base loads — always run for coordinator + owner + site_director
  const [todaysWork, queue, studyPressure, funnelSummary, coordinatorStats] = await Promise.all([
    loadTodaysRecruitmentWork(supabase, organizationId, user.id),
    loadRecruitmentQueue(supabase, organizationId, user.id, effectiveRole, {
      scope: roleExperience === 'owner' ? 'all' : 'default',
    }),
    loadStudyPressureCards(supabase, organizationId),
    loadRecruitmentFunnelSummary(supabase, organizationId),
    loadCoordinatorRecruitmentStats(supabase, organizationId, user.id),
  ])

  const model = toRecruitmentViewModel({ todaysWork, queue, studyPressure }, memberships, organizationId)

  // Owner/site_director-only loads
  let sourceEffectiveness = undefined
  let benchmarkReport = null
  let studyForecasts: { studyId: string; studyName?: string; forecast: import('@/lib/crm/recruitment-forecast').RecruitmentForecast }[] = []

  if (isOwnerOrDirector) {
    const [sourceReport, benchmark] = await Promise.all([
      loadSourceEffectiveness(supabase, organizationId),
      computeSiteBenchmarkValues(supabase, organizationId),
    ])
    sourceEffectiveness = sourceReport
    benchmarkReport = benchmark

    // Load forecasts for active studies (distinct studies with leads, up to 10)
    // Scope patient_study_matches to this org by first fetching org study IDs
    const { data: orgStudyData } = await supabase
      .from('studies')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(200)

    const orgStudyIds = ((orgStudyData as { id: string }[] | null) ?? []).map((s) => s.id)

    const matchData = orgStudyIds.length > 0
      ? (await supabase
          .from('patient_study_matches')
          .select('study_id')
          .in('study_id', orgStudyIds)
          .limit(100)).data
      : null

    const matches = (matchData as { study_id: string }[] | null) ?? []
    const uniqueStudyIds = [...new Set(matches.map((m) => m.study_id))].slice(0, 10)

    if (uniqueStudyIds.length > 0) {
      // Fetch study names
      const { data: studyData } = await supabase
        .from('studies')
        .select('id, name')
        .in('id', uniqueStudyIds)

      const studyNames = new Map(
        ((studyData as { id: string; name: string }[] | null) ?? []).map((s) => [s.id, s.name]),
      )

      const forecasts = await Promise.all(
        uniqueStudyIds.map((studyId) =>
          loadRecruitmentForecastForStudy(supabase, organizationId, studyId).then((forecast) => ({
            studyId,
            studyName: studyNames.get(studyId),
            forecast,
          })),
        ),
      )
      studyForecasts = forecasts
    }
  }

  // PI-only: load forecasts keyed to the studies already in studyPressure
  let piStudies: {
    studyId: string
    studyName: string
    randomizedCount: number
    enrollmentTarget: number
    qualifiedCount: number
    scheduledCount: number
    forecastRisk: 'on_track' | 'at_risk' | 'critical' | 'impossible' | null
    workspaceHref: string
  }[] = []

  if (roleExperience === 'pi' && model.studyPressure.length > 0) {
    const piStudyIds = model.studyPressure.map((card) => card.study_id)

    const piForecasts = await Promise.all(
      piStudyIds.map((studyId) =>
        loadRecruitmentForecastForStudy(supabase, organizationId, studyId).then((forecast) => ({
          studyId,
          forecast,
        })),
      ),
    )

    const piForecastMap = new Map(piForecasts.map((f) => [f.studyId, f.forecast]))

    piStudies = model.studyPressure.map((card) => {
      const forecast = piForecastMap.get(card.study_id)
      return {
        studyId: card.study_id,
        studyName: card.study_name,
        randomizedCount: card.randomized_count,
        enrollmentTarget: card.target_leads ?? 0,
        qualifiedCount: card.qualified_count ?? 0,
        scheduledCount: card.scheduled_count ?? 0,
        forecastRisk: forecast?.risk_classification ?? null,
        workspaceHref: `/studies/${card.study_id}/workspace`,
      }
    })
  }

  return (
    <RecruitmentCommandCenterShell
      model={model}
      organizationId={organizationId}
      result={result}
      reason={reason}
      funnelSummary={funnelSummary}
      coordinatorStats={coordinatorStats}
      sourceEffectiveness={sourceEffectiveness}
      studyForecasts={studyForecasts}
      benchmarkReport={benchmarkReport}
      piStudies={piStudies}
    />
  )
}
