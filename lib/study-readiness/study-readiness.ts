// ── Study Readiness Engine ────────────────────────────────────────────────────
// Framework-only foundation. Aggregates readiness across operational domains.
// No UI, no migrations, no DB changes, no activation gate.

// ── Blocker types ────────────────────────────────────────────────────────────

export type BlockerSeverity = 'critical' | 'warning' | 'info'

export type ReadinessBlocker = {
  domain: string
  severity: BlockerSeverity
  message: string
  source?: string // e.g. 'regulatory', 'source', 'pharmacy'
}

// ── Domain types ─────────────────────────────────────────────────────────────

export type DomainStatus = 'ready' | 'warning' | 'blocked'

export type ReadinessDomain = {
  domain: string
  status: DomainStatus
  score: number // 0–100
  blockers: ReadinessBlocker[]
}

// ── Overall result ───────────────────────────────────────────────────────────

export type OverallStatus = 'ready' | 'warning' | 'blocked'

export type StudyReadiness = {
  overall: OverallStatus
  overallScore: number // 0–100
  domains: ReadinessDomain[]
  allBlockers: ReadinessBlocker[]
  criticalBlockers: ReadinessBlocker[]
  warnings: ReadinessBlocker[]
  infoMessages: ReadinessBlocker[]
  domainCount: number
  readyDomainCount: number
  warningDomainCount: number
  blockedDomainCount: number
}

// ── Domain evaluator type ────────────────────────────────────────────────────

export type ReadinessEvaluator = (
  studyId: string,
) => Promise<ReadinessDomain> | ReadinessDomain

// ── Status determination ─────────────────────────────────────────────────────

function domainStatusFromScore(score: number): DomainStatus {
  if (score >= 80) return 'ready'
  if (score >= 50) return 'warning'
  return 'blocked'
}

function overallStatusFromDomains(domains: ReadinessDomain[]): OverallStatus {
  const anyBlocked = domains.some((d) => d.status === 'blocked')
  const anyWarning = domains.some((d) => d.status === 'warning')
  if (anyBlocked) return 'blocked'
  if (anyWarning) return 'warning'
  return 'ready'
}

function weightedOverallScore(domains: ReadinessDomain[]): number {
  if (domains.length === 0) return 100
  const total = domains.reduce((sum, d) => sum + d.score, 0)
  return Math.round(total / domains.length)
}

// ── Placeholder evaluators ───────────────────────────────────────────────────
// These return static readiness for the framework foundation.
// In future sprints they will connect to real runtime data sources.

export function evaluateRegulatoryReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'regulatory',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateSourceReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'source',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluatePharmacyReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'pharmacy',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateLabReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'lab',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateSystemsReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'systems',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateTrainingReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'training',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateContractReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'contract',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

export function evaluateBudgetReadiness(_studyId: string): ReadinessDomain {
  return {
    domain: 'budget',
    status: 'ready',
    score: 100,
    blockers: [],
  }
}

// ── Default evaluator map ────────────────────────────────────────────────────

export const DEFAULT_EVALUATORS: Record<string, ReadinessEvaluator> = {
  regulatory: evaluateRegulatoryReadiness,
  source: evaluateSourceReadiness,
  pharmacy: evaluatePharmacyReadiness,
  lab: evaluateLabReadiness,
  systems: evaluateSystemsReadiness,
  training: evaluateTrainingReadiness,
  contract: evaluateContractReadiness,
  budget: evaluateBudgetReadiness,
}

// ── Aggregation engine ───────────────────────────────────────────────────────

/**
 * Compute overall study readiness by evaluating all domains.
 *
 * @param studyId - The study to evaluate
 * @param evaluators - Optional custom evaluator map (defaults to all-ready placeholders)
 * @returns StudyReadiness with overall status, score, and per-domain details
 */
export async function computeStudyReadiness(
  studyId: string,
  evaluators: Record<string, ReadinessEvaluator> = DEFAULT_EVALUATORS,
): Promise<StudyReadiness> {
  const domainNames = Object.keys(evaluators)

  const domainResults = await Promise.all(
    domainNames.map(async (name) => {
      const evaluator = evaluators[name]
      return evaluator(studyId)
    }),
  )

  const allBlockers = domainResults.flatMap((d) => d.blockers)
  const criticalBlockers = allBlockers.filter((b) => b.severity === 'critical')
  const warnings = allBlockers.filter((b) => b.severity === 'warning')
  const infoMessages = allBlockers.filter((b) => b.severity === 'info')

  const overallScore = weightedOverallScore(domainResults)
  const overall = overallStatusFromDomains(domainResults)

  const readyDomainCount = domainResults.filter((d) => d.status === 'ready').length
  const warningDomainCount = domainResults.filter((d) => d.status === 'warning').length
  const blockedDomainCount = domainResults.filter((d) => d.status === 'blocked').length

  return {
    overall,
    overallScore,
    domains: domainResults,
    allBlockers,
    criticalBlockers,
    warnings,
    infoMessages,
    domainCount: domainNames.length,
    readyDomainCount,
    warningDomainCount,
    blockedDomainCount,
  }
}
