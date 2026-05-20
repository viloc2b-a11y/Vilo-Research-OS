import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import {
  sortRegulatorySignals,
  summarizeRegulatorySignals,
} from '@/lib/subject/regulatory-signals/summarize'
import {
  applyVisibleCap,
  collapseRegulatorySignals,
  OVERLAY_SIGNAL_LIST_VISIBLE,
} from '@/lib/subject/signal-density'
import type {
  RegulatorySignalItem,
  RegulatorySignalSeverity,
  RegulatorySignalType,
  SubjectRegulatorySignalsModel,
} from '@/lib/subject/regulatory-signals/types'

const SIGNAL_LABELS: Record<RegulatorySignalType, string> = {
  missed_visit: 'Missed visit',
  out_of_window_visit: 'Out-of-window visit',
  blocked_procedure: 'Blocked procedure',
  incomplete_procedure: 'Incomplete procedure',
  validation_finding: 'Validation finding',
  pending_source_review: 'Pending source review',
  overdue_workflow: 'Overdue workflow',
  pending_signature: 'Pending signature',
}

function recommendedAction(type: RegulatorySignalType): string {
  switch (type) {
    case 'missed_visit':
      return 'Reschedule or document the missed visit per protocol and site SOP.'
    case 'out_of_window_visit':
      return 'Review visit window compliance; document rationale before proceeding.'
    case 'blocked_procedure':
      return 'Resolve blocking validation on source capture before continuing.'
    case 'incomplete_procedure':
      return 'Complete required source fields and clear validation holds.'
    case 'validation_finding':
      return 'Acknowledge or resolve the validation finding with documented reason.'
    case 'pending_source_review':
      return 'Complete source capture or advance response set through review.'
    case 'overdue_workflow':
      return 'Complete or reassign the overdue coordinator workflow action.'
    case 'pending_signature':
      return 'Obtain required coordinator or investigator signature on visit closeout.'
    default:
      return 'Review and resolve this regulatory signal.'
  }
}

function isoOrNow(value: string | null | undefined): string {
  if (!value) return new Date().toISOString()
  return value
}

function pushItem(
  items: RegulatorySignalItem[],
  seen: Set<string>,
  item: RegulatorySignalItem,
) {
  if (seen.has(item.id)) return
  seen.add(item.id)
  items.push(item)
}

export function buildRegulatorySignalsFromOperationalIntelligence(
  intelligence: SubjectOperationalIntelligence,
  links?: { moreHref?: string | null },
): SubjectRegulatorySignalsModel {
  const items: RegulatorySignalItem[] = []
  const seen = new Set<string>()
  const blockedVisitIds = new Set(
    intelligence.visitTimeline
      .filter((v) => v.blockedProcedureCount > 0)
      .map((v) => v.visitId),
  )

  for (const visit of intelligence.visitTimeline) {
    const occurredAt = isoOrNow(visit.actualDate ?? visit.scheduledDate)
    const base = {
      visitId: visit.visitId,
      visitName: visit.visitName,
      href: visit.visitDetailHref,
      captureHref: visit.captureHref,
      reviewHref: visit.reviewHref,
      status: 'open' as const,
      isUnresolved: true,
    }

    if (visit.visitStatus === 'missed') {
      pushItem(items, seen, {
        id: `missed-${visit.visitId}`,
        signalType: 'missed_visit',
        title: `${visit.visitName} — missed`,
        description: 'Visit marked missed in operational status.',
        occurredAt,
        severity: 'critical',
        priority: null,
        recommendedAction: recommendedAction('missed_visit'),
        sourceLabel: SIGNAL_LABELS.missed_visit,
        ...base,
      })
    }

    if (
      visit.visitStatus === 'out_of_window' ||
      visit.windowStatus === 'outside_window'
    ) {
      pushItem(items, seen, {
        id: `oow-${visit.visitId}`,
        signalType: 'out_of_window_visit',
        title: `${visit.visitName} — out of window`,
        description: `Window status: ${visit.windowStatus.replace(/_/g, ' ')}.`,
        occurredAt,
        severity: visit.windowStatus === 'outside_window' ? 'high' : 'warning',
        priority: null,
        recommendedAction: recommendedAction('out_of_window_visit'),
        sourceLabel: SIGNAL_LABELS.out_of_window_visit,
        ...base,
      })
    }

    if (visit.blockedProcedureCount > 0) {
      pushItem(items, seen, {
        id: `blocked-${visit.visitId}`,
        signalType: 'blocked_procedure',
        title: `${visit.visitName} — ${visit.blockedProcedureCount} blocked procedure(s)`,
        description: 'Procedure validation is blocking execution.',
        occurredAt,
        severity: 'critical',
        priority: null,
        recommendedAction: recommendedAction('blocked_procedure'),
        sourceLabel: SIGNAL_LABELS.blocked_procedure,
        ...base,
      })
    }

    const needsSource =
      visit.sourceStatus === 'not_started' ||
      visit.sourceStatus === 'draft' ||
      (visit.sourceStatus === 'submitted' &&
        (visit.visitReviewStatus === 'draft' || visit.visitReviewStatus === 'reopened'))

    if (
      needsSource &&
      visit.visitStatus !== 'missed' &&
      visit.visitStatus !== 'cancelled'
    ) {
      pushItem(items, seen, {
        id: `source-pending-${visit.visitId}`,
        signalType: 'pending_source_review',
        title: `${visit.visitName} — source ${visit.sourceStatus.replace(/_/g, ' ')}`,
        description: 'Source capture or review is not complete for this visit.',
        occurredAt,
        severity: visit.sourceStatus === 'not_started' ? 'warning' : 'high',
        priority: null,
        recommendedAction: recommendedAction('pending_source_review'),
        sourceLabel: SIGNAL_LABELS.pending_source_review,
        ...base,
      })
    }
  }

  for (const issue of intelligence.validationIssues) {
    if (issue.kind === 'blocked' && issue.visitId && blockedVisitIds.has(issue.visitId)) {
      continue
    }

    let signalType: RegulatorySignalType = 'validation_finding'
    let severity: RegulatorySignalSeverity = 'warning'

    if (issue.kind === 'blocked') {
      signalType = 'blocked_procedure'
      severity = 'critical'
    } else if (issue.kind === 'incomplete') {
      signalType = 'incomplete_procedure'
      severity = 'high'
    } else if (issue.kind === 'finding') {
      signalType = 'validation_finding'
      severity = 'high'
    }

    pushItem(items, seen, {
      id: `val-${issue.id}`,
      signalType,
      title: issue.label,
      description: issue.visitName ? `Visit: ${issue.visitName}` : null,
      occurredAt: new Date().toISOString(),
      visitId: issue.visitId,
      visitName: issue.visitName,
      severity,
      priority: null,
      status: 'open',
      isUnresolved: true,
      recommendedAction: recommendedAction(signalType),
      sourceLabel: SIGNAL_LABELS[signalType],
      href: issue.href,
      captureHref: issue.href.startsWith('/source/capture') ? issue.href : null,
      reviewHref: issue.href.startsWith('/source/response-set') ? issue.href : null,
    })
  }

  for (const action of intelligence.pendingActions) {
    if (!action.isOverdue) continue

    pushItem(items, seen, {
      id: `wf-overdue-${action.id}`,
      signalType: 'overdue_workflow',
      title: action.title,
      description: action.dueDate ? `Due ${action.dueDate}` : null,
      occurredAt: isoOrNow(action.dueDate),
      visitId: null,
      visitName: null,
      severity: action.priority === 'urgent' ? 'critical' : 'high',
      priority: action.priority,
      status: 'open',
      isUnresolved: true,
      recommendedAction: recommendedAction('overdue_workflow'),
      sourceLabel: SIGNAL_LABELS.overdue_workflow,
      href: action.href,
      captureHref: null,
      reviewHref: null,
    })
  }

  for (const sig of intelligence.pendingSignatures) {
    pushItem(items, seen, {
      id: `sig-${sig.id}`,
      signalType: 'pending_signature',
      title: sig.label,
      description: sig.visitName ? `Visit: ${sig.visitName}` : null,
      occurredAt: new Date().toISOString(),
      visitId: null,
      visitName: sig.visitName,
      severity: sig.kind === 'investigator' ? 'high' : 'warning',
      priority: null,
      status: 'open',
      isUnresolved: true,
      recommendedAction: recommendedAction('pending_signature'),
      sourceLabel: SIGNAL_LABELS.pending_signature,
      href: sig.href,
      captureHref: null,
      reviewHref: null,
    })
  }

  const deduped = collapseRegulatorySignals(sortRegulatorySignals(items))
  const summary = summarizeRegulatorySignals(deduped)
  const capped = applyVisibleCap(deduped, OVERLAY_SIGNAL_LIST_VISIBLE)
  const moreHref =
    capped.hiddenCount > 0 ? (links?.moreHref ?? null) : null

  return {
    hasFormalDeviationRecords: false,
    items: capped.visible,
    summary,
    hiddenCount: capped.hiddenCount,
    moreHref,
  }
}
