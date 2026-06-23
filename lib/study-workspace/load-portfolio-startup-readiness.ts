import { createServerClient } from '@/lib/supabase/server'
import { checkStudyStartupReadiness, type StartupReadinessResult } from './study-startup-readiness'

// ── Types ────────────────────────────────────────────────────────────────────

export type PortfolioStartupSummary = {
  totalStudies: number
  byStatus: Record<StartupReadinessResult['startupLabel'], number>
  averageScore: number
  blockedCount: number
  totalBlockers: number
  readyCount: number
  almostReadyCount: number
  atRiskCount: number
  notReadyCount: number
  studies: {
    studyId: string
    studyName: string
    score: number
    label: StartupReadinessResult['startupLabel']
    blockerCount: number
  }[]
}

// ── Portfolio loader ─────────────────────────────────────────────────────────

/**
 * Load startup readiness across all studies in the organization.
 * Aggregates individual study readiness into portfolio-level metrics.
 */
export async function loadPortfolioStartupReadiness(
  organizationId: string,
): Promise<PortfolioStartupSummary> {
  const supabase = await createServerClient()

  // Get all studies for the organization
  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (!studies || studies.length === 0) {
    return {
      totalStudies: 0,
      byStatus: { Ready: 0, 'Almost Ready': 0, 'At Risk': 0, 'Not Ready': 0 },
      averageScore: 0,
      blockedCount: 0,
      totalBlockers: 0,
      readyCount: 0,
      almostReadyCount: 0,
      atRiskCount: 0,
      notReadyCount: 0,
      studies: [],
    }
  }

  // Load readiness for each study (limit to avoid overwhelming)
  const batchSize = 20
  const batches: StartupReadinessResult[][] = []
  for (let i = 0; i < studies.length; i += batchSize) {
    const batch = await Promise.all(
      studies.slice(i, i + batchSize).map((s) => checkStudyStartupReadiness(s.id)),
    )
    batches.push(batch)
  }
  const allReadiness = batches.flat()

  // Aggregate
  const byStatus: Record<string, number> = { Ready: 0, 'Almost Ready': 0, 'At Risk': 0, 'Not Ready': 0 }
  let totalScore = 0
  let totalBlockers = 0

  const studyEntries: PortfolioStartupSummary['studies'] = []

  for (let i = 0; i < allReadiness.length; i++) {
    const r = allReadiness[i]
    byStatus[r.startupLabel] = (byStatus[r.startupLabel] ?? 0) + 1
    totalScore += r.startupScore
    totalBlockers += r.blockers.length

    studyEntries.push({
      studyId: studies[i].id,
      studyName: studies[i].name,
      score: r.startupScore,
      label: r.startupLabel,
      blockerCount: r.blockers.length,
    })
  }

  // Sort: Not Ready first, then At Risk, then Almost Ready, then Ready
  const sortOrder = { 'Not Ready': 0, 'At Risk': 1, 'Almost Ready': 2, Ready: 3 }
  studyEntries.sort((a, b) => (sortOrder[a.label] ?? 9) - (sortOrder[b.label] ?? 9))

  return {
    totalStudies: studies.length,
    byStatus: byStatus as PortfolioStartupSummary['byStatus'],
    averageScore: studies.length > 0 ? Math.round(totalScore / studies.length) : 0,
    blockedCount: allReadiness.filter((r) => r.startupLabel === 'Not Ready' || r.startupLabel === 'At Risk').length,
    totalBlockers,
    readyCount: byStatus.Ready ?? 0,
    almostReadyCount: byStatus['Almost Ready'] ?? 0,
    atRiskCount: byStatus['At Risk'] ?? 0,
    notReadyCount: byStatus['Not Ready'] ?? 0,
    studies: studyEntries,
  }
}
