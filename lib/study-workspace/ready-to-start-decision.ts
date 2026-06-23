import { createServerClient } from '@/lib/supabase/server'
import { checkStudyStartupReadiness, type StartupReadinessResult } from './study-startup-readiness'
import { loadStudyTechnologyStack, type TechnologyStack } from './load-study-technology-stack'
import { loadStudySystems } from './load-study-systems'
import { calculateAccessReadiness } from './study-system-access'
import { checkEnrollmentReadiness } from './study-system-access'

// ── Types ────────────────────────────────────────────────────────────────────

export type ReadyToStartStatus = 'READY_TO_START' | 'ALMOST_READY' | 'NOT_READY'

export type EvidenceItem = {
  category: 'system' | 'access' | 'enrollment' | 'technology'
  type: string
  message: string
  severity: 'blocker' | 'warning'
  owner?: string
  systemName?: string
  nextAction?: string
}

export type ReadyToStartDecision = {
  status: ReadyToStartStatus
  score: number
  startupScore: number
  technologyHealth: number
  enrollmentReady: boolean

  blockers: EvidenceItem[]
  warnings: EvidenceItem[]
  allItems: EvidenceItem[]

  nextActions: string[]
  owners: { role: string; issues: string[] }[]

  evidence: {
    systemCount: number
    activeSystemCount: number
    accessIssues: number
    pendingAccess: number
    technologyRisks: number
    criticalRisks: number
    enrollmentBlockers: number
  }
}

// ── Owner assignment matrix ──────────────────────────────────────────────────

function assignOwner(type: string, systemName?: string): string {
  const lower = type.toLowerCase()
  const sysName = (systemName ?? '').toLowerCase()

  if (lower.includes('access') || lower.includes('coordinator')) return 'Coordinator'
  if (lower.includes('irt') || lower.includes('drug') || lower.includes('pharmacy')) return 'Pharmacy'
  if (lower.includes('irb') || lower.includes('regulatory') || lower.includes('submission')) return 'Regulatory'
  if (lower.includes('payment') || lower.includes('finance') || lower.includes('greenphire')) return 'Finance'
  if (lower.includes('recruitment') || lower.includes('subjectwell')) return 'Recruitment'
  if (lower.includes('training') || lower.includes('lms')) return 'Training'
  if (lower.includes('lab') || lower.includes('labcorp') || lower.includes('quest')) return 'Lab Manager'
  if (lower.includes('launch') || lower.includes('url') || lower.includes('config')) return 'Coordinator'
  if (lower.includes('enrollment') || lower.includes('startup') || lower.includes('gate')) return 'Startup Manager'
  if (lower.includes('inactive') || lower.includes('obsolete')) return 'Coordinator'
  return 'Coordinator' // default
}

function generateNextAction(item: EvidenceItem): string {
  if (item.nextAction) return item.nextAction
  const sys = item.systemName ? ` for ${item.systemName}` : ''
  const type = item.type.toLowerCase()

  if (type.includes('access') && type.includes('issue')) return `Resolve access issue${sys}`
  if (type.includes('access') && type.includes('missing')) return `Request access${sys}`
  if (type.includes('url') || type.includes('launch')) return `Configure launch URL${sys}`
  if (type.includes('inactive')) return `Activate or remove inactive system${sys}`
  if (type.includes('enrollment')) return `Resolve enrollment blockers before proceeding`
  if (type.includes('technology') || type.includes('risk')) return `Address technology risk${sys}`
  if (type.includes('registration') || type.includes('register')) return `Register recommended system${sys}`
  return `Review ${type} issue${sys}`
}

// ── Main decision engine ─────────────────────────────────────────────────────

/**
 * Determine whether a study is ready to start.
 *
 * This is the single operational decision engine.
 * It consumes existing checkStudyStartupReadiness() — no duplicate calculations.
 *
 * Output: READY_TO_START | ALMOST_READY | NOT_READY with full evidence.
 */
export async function determineStudyStartReadiness(
  studyId: string,
): Promise<ReadyToStartDecision> {
  const supabase = await createServerClient()

  // Load all source data in parallel — reuses existing functions
  const [startupReadiness, techStack, systems, accessSummary, enrollmentGate] =
    await Promise.all([
      checkStudyStartupReadiness(studyId),
      loadStudyTechnologyStack(studyId),
      loadStudySystems(supabase, studyId),
      calculateAccessReadiness(supabase, studyId),
      checkEnrollmentReadiness(supabase, studyId),
    ])

  const evidence: EvidenceItem[] = []

  // ── 1. System blockers ──
  for (const sys of systems) {
    if (sys.active && !sys.launch_url) {
      evidence.push({
        category: 'system',
        type: 'missing_launch_url',
        message: `${sys.system_name} has no launch URL configured`,
        severity: 'warning',
        owner: assignOwner('launch url'),
        systemName: sys.system_name,
        nextAction: `Configure launch URL for ${sys.system_name}`,
      })
    }
    if (!sys.active && systems.indexOf(sys) < 3) {
      // Only warn about first few inactive systems
      evidence.push({
        category: 'system',
        type: 'inactive_system',
        message: `${sys.system_name} is inactive`,
        severity: 'warning',
        owner: assignOwner('inactive'),
        systemName: sys.system_name,
        nextAction: `Activate or remove ${sys.system_name}`,
      })
    }
  }

  // ── 2. Access blockers ──
  for (const blocker of accessSummary.blockers) {
    evidence.push({
      category: 'access',
      type: 'access_issue',
      message: `${blocker.systemName} (${blocker.role}) — ${blocker.notes ?? 'access issue'}`,
      severity: 'blocker',
      owner: assignOwner(blocker.systemName),
      systemName: blocker.systemName,
      nextAction: `Resolve ${blocker.systemName} access issue for ${blocker.role}`,
    })
  }

  // Pending access requests
  if (accessSummary.pending > 0) {
    evidence.push({
      category: 'access',
      type: 'pending_access',
      message: `${accessSummary.pending} pending access request(s)`,
      severity: 'warning',
      owner: 'Coordinator',
      nextAction: `Follow up on ${accessSummary.pending} pending access request(s)`,
    })
  }

  // ── 3. Enrollment blockers ──
  if (!enrollmentGate.ready) {
    for (const b of enrollmentGate.blockers) {
      evidence.push({
        category: 'enrollment',
        type: 'enrollment_blocker',
        message: b,
        severity: 'blocker',
        owner: assignOwner('enrollment'),
        nextAction: 'Resolve enrollment blockers before proceeding',
      })
    }
  }

  // ── 4. Technology risks ──
  for (const risk of techStack.risks) {
    evidence.push({
      category: 'technology',
      type: risk.type,
      message: risk.message,
      severity: risk.severity === 'critical' ? 'blocker' : 'warning',
      owner: assignOwner(risk.type),
      systemName: risk.systemName,
      nextAction: generateNextAction({
        category: 'technology',
        type: risk.type,
        message: risk.message,
        severity: risk.severity === 'critical' ? 'blocker' : 'warning',
      }),
    })
  }

  // ── Decision logic ──
  const blockers = evidence.filter((e) => e.severity === 'blocker')
  const warnings = evidence.filter((e) => e.severity === 'warning')

  const enrollmentReady = enrollmentGate.ready
  const techHealth = techStack.metrics.technologyHealthScore

  let status: ReadyToStartStatus
  let score: number

  if (blockers.length === 0 && enrollmentReady && techHealth >= 80) {
    // READY_TO_START: no blockers, enrollment ready, tech healthy
    score = Math.min(100, startupReadiness.startupScore)
    status = warnings.length > 0 ? 'ALMOST_READY' : 'READY_TO_START'
  } else if (blockers.length === 0 && enrollmentReady) {
    // ALMOST_READY: no blockers but tech health < 80
    score = Math.min(80, startupReadiness.startupScore)
    status = 'ALMOST_READY'
  } else {
    // NOT_READY: any blocker, enrollment not ready, or critical issues
    score = Math.min(50, startupReadiness.startupScore)
    status = 'NOT_READY'
  }

  // ── Group owners ──
  const ownerMap = new Map<string, string[]>()
  for (const item of evidence) {
    if (item.owner) {
      if (!ownerMap.has(item.owner)) ownerMap.set(item.owner, [])
      ownerMap.get(item.owner)!.push(item.message)
    }
  }
  const owners = Array.from(ownerMap.entries()).map(([role, issues]) => ({
    role,
    issues,
  }))

  // ── Next actions ──
  const nextActions: string[] = []
  for (const item of evidence) {
    const action = generateNextAction(item)
    if (!nextActions.includes(action)) {
      nextActions.push(action)
    }
  }

  return {
    status,
    score,
    startupScore: startupReadiness.startupScore,
    technologyHealth: techHealth,
    enrollmentReady,
    blockers,
    warnings,
    allItems: evidence,
    nextActions: nextActions.slice(0, 5), // top 5
    owners,
    evidence: {
      systemCount: systems.length,
      activeSystemCount: systems.filter((s) => s.active).length,
      accessIssues: accessSummary.blocked,
      pendingAccess: accessSummary.pending,
      technologyRisks: techStack.risks.length,
      criticalRisks: techStack.risks.filter((r) => r.severity === 'critical').length,
      enrollmentBlockers: enrollmentGate.blockers.length,
    },
  }
}
