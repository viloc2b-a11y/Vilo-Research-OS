import type { ReadinessDomain, ReadinessBlocker } from './study-readiness'
import type { RegulatorySignal } from '@/lib/regulatory-center/regulatory-signals'
import type { StudyRegulatoryPacket } from '@/lib/regulatory-center/study-regulatory-packet'

// ── Pure evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate regulatory readiness from a packet and its signals.
 *
 * This is a pure function — no DB calls, no side effects.
 * It converts regulatory signals into readiness blockers and computes
 * the domain status and score.
 */
export function evaluateRegulatoryReadiness(
  packet: StudyRegulatoryPacket,
  signals: RegulatorySignal[],
): ReadinessDomain {
  const blockers: ReadinessBlocker[] = []

  // Convert regulatory signals to readiness blockers
  for (const signal of signals) {
    blockers.push({
      domain: 'regulatory',
      severity: signal.severity,
      message: signal.title,
      source: signal.href,
    })
  }

  // Compute status from critical signals
  const hasCritical = signals.some((s) => s.severity === 'critical')
  const hasWarning = signals.some((s) => s.severity === 'warning')
  const hasInfo = signals.some((s) => s.severity === 'info')
  const criticalCount = signals.filter((s) => s.severity === 'critical').length
  const warningCount = signals.filter((s) => s.severity === 'warning').length

  // Score computation
  let score: number
  let status: 'ready' | 'warning' | 'blocked'

  if (hasCritical) {
    // Blocked: score drops with each critical signal (max 49, floor 10)
    score = Math.max(10, 49 - criticalCount * 8)
    status = 'blocked'
  } else if (hasWarning) {
    // Warning: score drops with each warning (50–79 range)
    score = Math.max(50, 79 - warningCount * 6)
    status = 'warning'
  } else if (packet.readiness === null && packet.allLinks.length === 0) {
    // No required items defined and no links at all
    score = 75
    status = 'warning'
    blockers.push({
      domain: 'regulatory',
      severity: 'info',
      message: 'No regulatory items defined for this study',
    })
  } else if (packet.readiness === null) {
    // Links exist but no required items
    score = 80
    status = 'ready'
    blockers.push({
      domain: 'regulatory',
      severity: 'info',
      message: 'No required regulatory items defined — all optional links active',
    })
  } else {
    // Use packet readiness as the base score
    score = packet.readiness
    status = score >= 80 ? 'ready' : score >= 50 ? 'warning' : 'blocked'
  }

  return { domain: 'regulatory', status, score, blockers }
}

// ── Server loader ────────────────────────────────────────────────────────────

/**
 * Load regulatory readiness for a study by fetching regulatory data
 * and evaluating it through the pure readiness function.
 *
 * This is the server-side entry point for the regulatory domain.
 * It can be called from computeStudyReadiness() or standalone.
 */
export async function loadRegulatoryReadinessDomain(
  studyId: string,
): Promise<ReadinessDomain> {
  // Lazy imports to avoid circular dependencies
  const { createServerClient } = await import('@/lib/supabase/server')
  const { getSessionUser, getPrimaryOrganizationId } = await import('@/lib/auth/session')
  const { loadRegulatoryPersonnel } = await import('@/lib/regulatory-center/regulatory-personnel')
  const { loadRegulatoryDocuments } = await import('@/lib/regulatory-center/regulatory-master-documents')
  const { loadOrgStudies, loadStudyLinksWithDetails } = await import('@/lib/regulatory-center/study-regulatory-links')
  const { loadStudyRegulatoryDocuments } = await import('@/lib/regulatory-center/study-regulatory-documents')
  const { buildStudyRegulatoryPacket } = await import('@/lib/regulatory-center/study-regulatory-packet')
  const { buildStudyRegulatorySignals } = await import('@/lib/regulatory-center/regulatory-signals')

  const supabase = await createServerClient()
  const user = await getSessionUser()
  const orgId = user ? await getPrimaryOrganizationId(user.id) : null

  if (!orgId) {
    return { domain: 'regulatory', status: 'blocked', score: 0, blockers: [
      { domain: 'regulatory', severity: 'critical', message: 'No organization context available' },
    ]}
  }

  const [personnel, documents] = await Promise.all([
    loadRegulatoryPersonnel(supabase, orgId),
    loadRegulatoryDocuments(supabase, orgId),
  ])

  const [studies, studyDocs] = await Promise.all([
    loadOrgStudies(supabase, orgId),
    loadStudyRegulatoryDocuments(supabase, studyId),
  ])

  const study = studies.find((s) => s.id === studyId)
  if (!study) {
    return { domain: 'regulatory', status: 'blocked', score: 0, blockers: [
      { domain: 'regulatory', severity: 'critical', message: 'Study not found' },
    ]}
  }

  const links = await loadStudyLinksWithDetails(supabase, orgId, studyId, personnel, documents)
  const packet = buildStudyRegulatoryPacket(study, links, studyDocs)
  const signals = buildStudyRegulatorySignals(studyId, packet, studyDocs)

  return evaluateRegulatoryReadiness(packet, signals)
}
