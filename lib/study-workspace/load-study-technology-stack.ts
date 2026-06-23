import { createServerClient } from '@/lib/supabase/server'
import type { StudySystemEntry } from './study-systems'
import type { StudySystemAccessEntry, AccessReadinessSummary } from './study-system-access'
import { calculateAccessReadiness } from './study-system-access'
import { loadStudySystems } from './load-study-systems'

// ── Category ordering ────────────────────────────────────────────────────────

export const TECH_STACK_CATEGORIES = [
  'Data Capture',
  'Randomization',
  'Patient Technology',
  'Labs',
  'Imaging',
  'Safety',
  'Payments',
  'Training',
  'Regulatory',
  'Recruitment',
  'Sponsor Portal',
  'CRO Portal',
  'Other',
] as const

// ── Types ────────────────────────────────────────────────────────────────────

export type TechnologyStackSystem = StudySystemEntry & {
  accessRecords: StudySystemAccessEntry[]
  mappedActivityCount: number
  recommendedActivityCount: number
}

export type TechnologyStackCategory = {
  category: string
  systems: TechnologyStackSystem[]
  count: number
}

export type TechnologyRisk = {
  type: 'no_launch_url' | 'access_blocker' | 'mapped_not_registered' | 'unmapped_activity' | 'recommended_not_registered' | 'inactive_mapped'
  message: string
  systemName?: string
  severity: 'info' | 'warning' | 'critical'
}

export type TechnologyStack = {
  categories: TechnologyStackCategory[]
  allSystems: TechnologyStackSystem[]
  metrics: TechnologyStackMetrics
  risks: TechnologyRisk[]
}

export type TechnologyStackMetrics = {
  totalSystems: number
  activeSystems: number
  inactiveSystems: number
  pinnedSystems: number
  systemsWithAccessIssues: number
  systemsWithPendingAccess: number
  mappedActivities: number
  recommendedActivities: number
  categoriesUsed: number
  technologyComplexityScore: number
  technologyComplexityLabel: 'Low' | 'Moderate' | 'High' | 'Very High'
  operationalDependencyScore: number
  operationalDependencyLabel: 'Low Dependency' | 'Moderate Dependency' | 'High Dependency' | 'Critical Dependency'
  technologyHealthScore: number
  technologyHealthLabel: 'Healthy' | 'Watch' | 'Risk' | 'Critical'
}

// ── Metrics calculation ──────────────────────────────────────────────────────

function computeComplexityLabel(score: number): TechnologyStackMetrics['technologyComplexityLabel'] {
  if (score <= 8) return 'Low'
  if (score <= 16) return 'Moderate'
  if (score <= 24) return 'High'
  return 'Very High'
}

function computeDependencyLabel(score: number): TechnologyStackMetrics['operationalDependencyLabel'] {
  if (score <= 20) return 'Low Dependency'
  if (score <= 40) return 'Moderate Dependency'
  if (score <= 60) return 'High Dependency'
  return 'Critical Dependency'
}

function computeHealthLabel(score: number): TechnologyStackMetrics['technologyHealthLabel'] {
  if (score >= 80) return 'Healthy'
  if (score >= 50) return 'Watch'
  if (score >= 25) return 'Risk'
  return 'Critical'
}

function computeMetrics(
  systems: TechnologyStackSystem[],
  accessIssues: number,
  pendingAccess: number,
  mappedActivities: number,
  recommendedActivities: number,
  accessSummary: AccessReadinessSummary,
): TechnologyStackMetrics {
  const activeSystems = systems.filter((s) => s.active).length
  const inactiveSystems = systems.filter((s) => !s.active).length
  const pinnedSystems = systems.filter((s) => s.pinned).length
  const categoriesUsed = new Set(systems.filter((s) => s.system_category).map((s) => s.system_category)).size

  // Technology Complexity Score = active_systems + access_issues + mapped_external_activities
  const technologyComplexityScore = activeSystems + accessIssues + mappedActivities

  // Operational Dependency Score = external_system_activities / total_mapped_activities * 100
  const operationalDependencyScore = mappedActivities > 0
    ? Math.round((recommendedActivities / mappedActivities) * 100)
    : 0

  // Technology Health Score = active_accesses / required_accesses * 100
  const technologyHealthScore = accessSummary.totalRequired > 0
    ? Math.round((accessSummary.completed / accessSummary.totalRequired) * 100)
    : 100

  return {
    totalSystems: systems.length,
    activeSystems,
    inactiveSystems,
    pinnedSystems,
    systemsWithAccessIssues: accessIssues,
    systemsWithPendingAccess: pendingAccess,
    mappedActivities,
    recommendedActivities,
    categoriesUsed,
    technologyComplexityScore,
    technologyComplexityLabel: computeComplexityLabel(technologyComplexityScore),
    operationalDependencyScore,
    operationalDependencyLabel: computeDependencyLabel(operationalDependencyScore),
    technologyHealthScore,
    technologyHealthLabel: computeHealthLabel(technologyHealthScore),
  }
}

// ── Risk detection ────────────────────────────────────────────────────────────

function detectRisks(
  systems: TechnologyStackSystem[],
  mappedActivities: { activityCode: string }[],
  recommendedActivities: { activityCode: string }[],
  accessSummary: AccessReadinessSummary,
): TechnologyRisk[] {
  const risks: TechnologyRisk[] = []

  // Systems without launch URLs (but active)
  for (const s of systems) {
    if (s.active && !s.launch_url) {
      risks.push({
        type: 'no_launch_url',
        message: `${s.system_name} has no launch URL configured`,
        systemName: s.system_name,
        severity: 'warning',
      })
    }
  }

  // Systems with access blockers
  for (const blocker of accessSummary.blockers) {
    risks.push({
      type: 'access_blocker',
      message: `${blocker.systemName} (${blocker.role}): ${blocker.notes ?? 'access issue'}`,
      systemName: blocker.systemName,
      severity: 'critical',
    })
  }

  // Inactive systems still mapped to activities
  for (const s of systems) {
    if (!s.active && s.mappedActivityCount > 0) {
      risks.push({
        type: 'inactive_mapped',
        message: `${s.system_name} is inactive but still mapped to ${s.mappedActivityCount} activity(ies)`,
        systemName: s.system_name,
        severity: 'warning',
      })
    }
  }

  return risks
}

// ── Systems grouped by category ───────────────────────────────────────────────

function groupByCategory(systems: TechnologyStackSystem[]): TechnologyStackCategory[] {
  const map = new Map<string, TechnologyStackSystem[]>()
  for (const s of systems) {
    const cat = s.system_category || 'Other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(s)
  }

  // Sort categories in defined order, unknowns at end
  const ordered: TechnologyStackCategory[] = []
  const seen = new Set<string>()

  for (const cat of TECH_STACK_CATEGORIES) {
    const list = map.get(cat)
    if (list) {
      ordered.push({ category: cat, systems: list, count: list.length })
      seen.add(cat)
    }
  }

  // Add any unknown categories at the end
  for (const [cat, list] of map) {
    if (!seen.has(cat)) {
      ordered.push({ category: cat, systems: list, count: list.length })
    }
  }

  return ordered
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load the complete Study Technology Stack for a study.
 * Aggregates systems, access data, activity mappings, and recommendations.
 */
export async function loadStudyTechnologyStack(
  studyId: string,
): Promise<TechnologyStack> {
  const supabase = await createServerClient()

  // Load all source data in parallel
  const [
    systems,
    accessRecords,
    accessSummary,
    activityMapRows,
    recommendationRows,
  ] = await Promise.all([
    loadStudySystems(supabase, studyId),
    supabase.from('study_system_access').select('*').eq('study_id', studyId)
      .then((r) => (r.data ?? []) as StudySystemAccessEntry[]),
    calculateAccessReadiness(supabase, studyId),
    supabase.from('activity_system_map').select('activity_code, system_library_id'),
    supabase.from('activity_system_recommendations').select('activity_code, system_library_id'),
  ])

  const mappedActivities = (activityMapRows.data ?? []) as { activity_code: string; system_library_id: string }[]
  const recommendedActivities = (recommendationRows.data ?? []) as { activity_code: string; system_library_id: string }[]

  // Build maps
  const accessBySystem = new Map<string, StudySystemAccessEntry[]>()
  for (const rec of accessRecords) {
    if (!accessBySystem.has(rec.study_system_id)) accessBySystem.set(rec.study_system_id, [])
    accessBySystem.get(rec.study_system_id)!.push(rec)
  }

  const mappedBySystem = new Map<string, Set<string>>()
  for (const m of mappedActivities) {
    if (!mappedBySystem.has(m.system_library_id)) mappedBySystem.set(m.system_library_id, new Set())
    mappedBySystem.get(m.system_library_id)!.add(m.activity_code)
  }

  const recommendedBySystem = new Map<string, Set<string>>()
  for (const r of recommendedActivities) {
    if (!recommendedBySystem.has(r.system_library_id)) recommendedBySystem.set(r.system_library_id, new Set())
    recommendedBySystem.get(r.system_library_id)!.add(r.activity_code)
  }

  // Build enriched systems
  const enrichedSystems: TechnologyStackSystem[] = systems.map((s) => ({
    ...s,
    accessRecords: accessBySystem.get(s.study_system_id) ?? [],
    mappedActivityCount: s.system_library_id ? (mappedBySystem.get(s.system_library_id)?.size ?? 0) : 0,
    recommendedActivityCount: s.system_library_id ? (recommendedBySystem.get(s.system_library_id)?.size ?? 0) : 0,
  }))

  // Compute aggregate metrics
  const accessIssues = accessRecords.filter((r) => r.access_status === 'Issue').length
  const pendingAccess = accessRecords.filter(
    (r) => r.access_status === 'Not Requested' || r.access_status === 'Requested',
  ).length

  const uniqueMappedActivities = [...new Set(mappedActivities.map((m) => m.activity_code))]
  const uniqueRecommendedActivities = [...new Set(recommendedActivities.map((r) => r.activity_code))]

  const metrics = computeMetrics(
    enrichedSystems,
    accessIssues,
    pendingAccess,
    uniqueMappedActivities.length,
    uniqueRecommendedActivities.length,
    accessSummary,
  )

  const categories = groupByCategory(enrichedSystems)
  const risks = detectRisks(enrichedSystems, uniqueMappedActivities.map((c) => ({ activityCode: c })), uniqueRecommendedActivities.map((c) => ({ activityCode: c })), accessSummary)

  return { categories, allSystems: enrichedSystems, metrics, risks }
}
