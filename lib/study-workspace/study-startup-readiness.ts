import { createServerClient } from '@/lib/supabase/server'
import { loadStudySystems } from './load-study-systems'
import { calculateAccessReadiness, checkEnrollmentReadiness } from './study-system-access'
import { loadStudyTechnologyStack, type TechnologyStack } from './load-study-technology-stack'

// ── Types ────────────────────────────────────────────────────────────────────

export type SystemReadiness = {
  totalSystems: number
  configuredSystems: number
  inactiveSystems: number
  systemsMissingUrls: number
  score: number // 0–100
}

export type AccessReadinessSection = {
  score: number
  pendingRequests: number
  accessIssues: number
  blockers: { systemName: string; role: string; notes: string | null }[]
}

export type TechnologyReadiness = {
  complexityLabel: string
  dependencyLabel: string
  healthScore: number
  healthLabel: string
  riskCount: number
  criticalRiskCount: number
}

export type EnrollmentReadiness = {
  ready: boolean
  blockers: string[]
}

export type StartupReadinessResult = {
  systemReadiness: SystemReadiness
  accessReadiness: AccessReadinessSection
  technologyReadiness: TechnologyReadiness
  enrollmentReadiness: EnrollmentReadiness
  startupScore: number
  startupLabel: 'Not Ready' | 'At Risk' | 'Almost Ready' | 'Ready'
  blockers: string[]
  recommendations: string[]
}

// ── Score computation ─────────────────────────────────────────────────────────

function computeStartupLabel(score: number): StartupReadinessResult['startupLabel'] {
  if (score >= 80) return 'Ready'
  if (score >= 50) return 'Almost Ready'
  if (score >= 25) return 'At Risk'
  return 'Not Ready'
}

function computeSystemReadiness(systems: { active: boolean; launch_url: string | null }[]): SystemReadiness {
  const totalSystems = systems.length
  const configuredSystems = systems.filter((s) => s.active).length
  const inactiveSystems = systems.filter((s) => !s.active).length
  const systemsMissingUrls = systems.filter((s) => s.active && !s.launch_url).length

  // Score: active / total * 100, penalized for missing URLs
  const baseScore = totalSystems > 0 ? (configuredSystems / totalSystems) * 100 : 100
  const urlPenalty = systemsMissingUrls * 5 // 5 points per missing URL
  const score = Math.max(0, Math.round(baseScore - urlPenalty))

  return { totalSystems, configuredSystems, inactiveSystems, systemsMissingUrls, score }
}

function computeAccessReadinessFromSummary(
  summary: Awaited<ReturnType<typeof calculateAccessReadiness>>,
): AccessReadinessSection {
  return {
    score: summary.totalRequired > 0 ? Math.round((summary.completed / summary.totalRequired) * 100) : 100,
    pendingRequests: summary.pending,
    accessIssues: summary.blocked,
    blockers: summary.blockers,
  }
}

function computeTechnologyReadiness(techStack: TechnologyStack): TechnologyReadiness {
  return {
    complexityLabel: techStack.metrics.technologyComplexityLabel,
    dependencyLabel: techStack.metrics.operationalDependencyLabel,
    healthScore: techStack.metrics.technologyHealthScore,
    healthLabel: techStack.metrics.technologyHealthLabel,
    riskCount: techStack.risks.length,
    criticalRiskCount: techStack.risks.filter((r) => r.severity === 'critical').length,
  }
}

function generateRecommendations(
  systemReadiness: SystemReadiness,
  accessSection: AccessReadinessSection,
  enrollmentReadiness: EnrollmentReadiness,
  techReadiness: TechnologyReadiness,
): string[] {
  const recs: string[] = []

  if (systemReadiness.systemsMissingUrls > 0) {
    recs.push(`Configure launch URLs for ${systemReadiness.systemsMissingUrls} system(s) missing URLs`)
  }
  if (systemReadiness.inactiveSystems > 0) {
    recs.push(`Review ${systemReadiness.inactiveSystems} inactive system(s) — activate or remove`)
  }
  if (accessSection.accessIssues > 0) {
    recs.push(`Resolve ${accessSection.accessIssues} access issue(s) blocking study staff`)
  }
  if (accessSection.pendingRequests > 0) {
    recs.push(`Follow up on ${accessSection.pendingRequests} pending access request(s)`)
  }
  if (enrollmentReadiness.blockers.length > 0) {
    recs.push(`Resolve enrollment blockers: ${enrollmentReadiness.blockers[0]}`)
  }
  if (techReadiness.criticalRiskCount > 0) {
    recs.push(`Address ${techReadiness.criticalRiskCount} critical technology risk(s)`)
  }
  if (recs.length === 0) {
    recs.push('No action items — study is ready for startup')
  }

  return recs
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Check the complete study startup readiness.
 * All scores are derived from existing runtime data — no manual scoring.
 */
export async function checkStudyStartupReadiness(
  studyId: string,
): Promise<StartupReadinessResult> {
  const supabase = await createServerClient()

  // Load all source data
  const [systems, accessSummary, techStack] = await Promise.all([
    loadStudySystems(supabase, studyId),
    calculateAccessReadiness(supabase, studyId),
    loadStudyTechnologyStack(studyId),
  ])

  // Compute sub-scores
  const systemReadiness = computeSystemReadiness(systems)
  const accessReadinessSection = computeAccessReadinessFromSummary(accessSummary)
  const technologyReadiness = computeTechnologyReadiness(techStack)
  const enrollmentGate = await checkEnrollmentReadiness(supabase, studyId)

  // Aggregate blockers
  const blockers: string[] = [
    ...accessReadinessSection.blockers.map(
      (b) => `Access: ${b.systemName} (${b.role}) — ${b.notes ?? 'issue'}`,
    ),
    ...enrollmentGate.blockers,
  ]

  // Startup Score = System Readiness + Access Readiness + Enrollment Readiness (weighted)
  // System Readiness: 30%, Access Readiness: 35%, Enrollment Readiness: 35%
  const startupScore = Math.round(
    systemReadiness.score * 0.30 +
    accessReadinessSection.score * 0.35 +
    (enrollmentGate.ready ? 100 : 0) * 0.35,
  )

  const recommendations = generateRecommendations(
    systemReadiness,
    accessReadinessSection,
    { ready: enrollmentGate.ready, blockers: enrollmentGate.blockers },
    technologyReadiness,
  )

  return {
    systemReadiness,
    accessReadiness: accessReadinessSection,
    technologyReadiness,
    enrollmentReadiness: { ready: enrollmentGate.ready, blockers: enrollmentGate.blockers },
    startupScore,
    startupLabel: computeStartupLabel(startupScore),
    blockers,
    recommendations,
  }
}
