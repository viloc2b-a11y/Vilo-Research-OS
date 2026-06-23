import type { StudyRegulatoryPacket } from './study-regulatory-packet'
import type { StudyRegulatoryDocumentEntry } from './study-regulatory-documents'

// ── Types ────────────────────────────────────────────────────────────────────

export type RegulatorySignalSeverity = 'critical' | 'warning' | 'info'

export type RegulatorySignal = {
  id: string
  title: string
  description: string
  severity: RegulatorySignalSeverity
  area: 'regulatory'
  href: string
  actionLabel: string
}

// ── Signal builder ───────────────────────────────────────────────────────────

/**
 * Build regulatory signals for a study based on its packet and study-specific docs.
 * Each signal has a clear title, severity, and action link.
 */
export function buildStudyRegulatorySignals(
  studyId: string,
  packet: StudyRegulatoryPacket,
  studySpecificDocs: StudyRegulatoryDocumentEntry[],
): RegulatorySignal[] {
  const signals: RegulatorySignal[] = []
  const baseHref = `/studies/${studyId}/workspace`

  // ── 1. Expired inherited master documents ──
  for (const item of packet.expired) {
    signals.push({
      id: `reg-expired-${item.id}`,
      title: `Expired: ${item.name}`,
      description: `${item.subtitle ?? ''} — take action to renew or replace`,
      severity: 'critical',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Review in Regulatory Center',
    })
  }

  // ── 2. Expiring inherited master documents ──
  for (const item of packet.expiring) {
    signals.push({
      id: `reg-expiring-${item.id}`,
      title: `Expiring: ${item.name}`,
      description: `${item.subtitle ?? ''} — renew before expiration`,
      severity: 'warning',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Review in Regulatory Center',
    })
  }

  // ── 3. Needs review inherited links ──
  for (const item of packet.needsReview) {
    signals.push({
      id: `reg-needs-review-${item.id}`,
      title: `Needs Review: ${item.name}`,
      description: item.subtitle ?? 'Requires regulatory staff attention',
      severity: 'warning',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Review',
    })
  }

  // ── 4. Missing required inherited items ──
  const missingRequired = packet.allLinks.filter(
    (i) => i.required && !i.isComplete && i.source === 'inherited',
  )
  for (const item of missingRequired) {
    signals.push({
      id: `reg-missing-required-${item.id}`,
      title: `Missing Required: ${item.name}`,
      description: `Required ${item.type === 'personnel' ? 'personnel' : 'document'} not fully configured`,
      severity: 'critical',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Configure',
    })
  }

  // ── 5. Study-specific document signals ──
  for (const doc of studySpecificDocs) {
    const docHref = `/studies/${studyId}/workspace`

    if (doc.status === 'missing' && doc.required) {
      signals.push({
        id: `reg-ss-missing-${doc.id}`,
        title: `Missing: ${doc.document_title}`,
        description: `${doc.document_type} is required — upload or record receipt`,
        severity: 'critical',
        area: 'regulatory',
        href: docHref,
        actionLabel: 'Resolve in Study Workspace',
      })
    }

    if (doc.status === 'rejected') {
      signals.push({
        id: `reg-ss-rejected-${doc.id}`,
        title: `Rejected: ${doc.document_title}`,
        description: `${doc.document_type} was rejected — review and resubmit`,
        severity: 'critical',
        area: 'regulatory',
        href: docHref,
        actionLabel: 'Review',
      })
    }

    if (doc.status === 'expired') {
      signals.push({
        id: `reg-ss-expired-${doc.id}`,
        title: `Expired: ${doc.document_title}`,
        description: `${doc.document_type} has expired — renew`,
        severity: 'critical',
        area: 'regulatory',
        href: docHref,
        actionLabel: 'Renew',
      })
    }
  }

  // ── 6. Specific key document checks ──
  const hasIrbApproval = studySpecificDocs.some(
    (d) => d.document_type === 'IRB Approval' && (d.status === 'approved' || d.status === 'submitted'),
  )
  if (!hasIrbApproval) {
    signals.push({
      id: 'reg-irb-approval',
      title: 'IRB Approval Missing',
      description: 'IRB approval is not recorded for this study',
      severity: 'critical',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Record IRB Approval',
    })
  }

  const has1572 = studySpecificDocs.some(
    (d) => d.document_type === '1572' && (d.status === 'approved' || d.status === 'submitted' || d.status === 'received'),
  )
  if (!has1572) {
    signals.push({
      id: 'reg-1572',
      title: '1572 Missing',
      description: 'FDA Form 1572 is not on file for this study',
      severity: 'critical',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Record 1572',
    })
  }

  const hasDelegationLog = studySpecificDocs.some(
    (d) => d.document_type === 'Delegation Log' && (d.status === 'approved' || d.status === 'submitted' || d.status === 'received'),
  )
  if (!hasDelegationLog) {
    signals.push({
      id: 'reg-delegation-log',
      title: 'Delegation Log Missing',
      description: 'Delegation of Authority log is not on file',
      severity: 'warning',
      area: 'regulatory',
      href: '/regulatory-center',
      actionLabel: 'Record Delegation Log',
    })
  }

  return signals
}

/**
 * Count regulatory signals by severity.
 */
export function countRegulatorySignals(signals: RegulatorySignal[]): {
  critical: number
  warning: number
  info: number
  total: number
} {
  const critical = signals.filter((s) => s.severity === 'critical').length
  const warning = signals.filter((s) => s.severity === 'warning').length
  const info = signals.filter((s) => s.severity === 'info').length
  return { critical, warning, info, total: critical + warning + info }
}
