import {
  performanceSubjectHref,
  performanceSubjectVisitsHref,
  performanceVisitHref,
} from '@/lib/performance/paths'
import { RISK_QUEUE_DISPLAY_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { VpiSubjectRiskSignalRow } from '@/lib/performance/read-layer/rpc-dashboard'
import {
  recommendedActionForSubjectSignal,
  recommendedActionLabel,
} from '@/lib/performance/scoring/recommended-actions'
import { scoreSubjectSignals } from '@/lib/performance/scoring/subject-scoring'
import type { SubjectSignalInput, SubjectSignalKind, ScoredSubject } from '@/lib/performance/scoring/types'
import { STATE_PRIORITY_RANK } from '@/lib/performance/scoring/types'
import type {
  SubjectRiskQueueItem,
  SubjectRiskReasonKind,
  SubjectRiskSeverity,
} from '@/app/(ops)/performance/_lib/performance-types'
import { SUBJECT_RISK_REASON_LABELS } from '@/app/(ops)/performance/_lib/performance-types'

const KNOWN_SIGNAL_KINDS: readonly SubjectSignalKind[] = [
  'missed_visit',
  'out_of_window',
  'overdue_action',
  'open_query',
  'blocked_procedure',
  'needs_resign',
  'window_warning',
  'unsigned_procedure_48h',
  'window_closing_today',
  'stale_subject',
  'governance_blocker',
  'governance_warning',
  'revenue_leakage',
  'earned_but_not_invoiced',
  'invoiceable_missing',
  'screen_failure_billable',
  'pass_through_unreimbursed',
  'stipend_unreconciled',
  'overdue_financial',
  'disputed_payment',
  'reverted_payment',
  'written_off_payment',
  'lab_worsening',
  'lab_consecutive_worsening',
  'lab_consecutive_abnormal',
  'lab_missing_repeat',
  'lab_follow_up_overdue',
  'lab_safety_review',
  'sae_reporting_overdue',
  'sae_reporting_due_soon',
  'sae_sponsor_pending',
]

function isSubjectSignalKind(value: string): value is SubjectSignalKind {
  return (KNOWN_SIGNAL_KINDS as readonly string[]).includes(value)
}

export function dedupeScoredSubjectsBySubjectId(subjects: ScoredSubject[]): ScoredSubject[] {
  const bySubject = new Map<string, ScoredSubject>()

  for (const row of subjects) {
    const key = `${row.studyId}:${row.subjectId}`
    const existing = bySubject.get(key)
    if (!existing) {
      bySubject.set(key, row)
      continue
    }
    if (row.priorityRank > existing.priorityRank) {
      bySubject.set(key, row)
      continue
    }
    if (row.priorityRank === existing.priorityRank && row.sortDate < existing.sortDate) {
      bySubject.set(key, row)
    }
  }

  return [...bySubject.values()]
}

export function compareScoredSubjects(a: ScoredSubject, b: ScoredSubject): number {
  const rankDelta = b.priorityRank - a.priorityRank
  if (rankDelta !== 0) return rankDelta
  return a.sortDate.localeCompare(b.sortDate)
}

export function sortScoredSubjects(subjects: ScoredSubject[]): ScoredSubject[] {
  return [...subjects].sort(compareScoredSubjects)
}

export function capScoredSubjects(subjects: ScoredSubject[], limit: number): ScoredSubject[] {
  return sortScoredSubjects(subjects).slice(0, limit)
}

const SIGNAL_TO_REASON: Record<SubjectSignalKind, SubjectRiskReasonKind> = {
  missed_visit: 'missed_visit',
  out_of_window: 'out_of_window',
  overdue_action: 'overdue_action',
  open_query: 'open_query',
  blocked_procedure: 'blocked_procedure',
  needs_resign: 'needs_resign',
  window_warning: 'window_warning',
  unsigned_procedure_48h: 'window_warning',
  window_closing_today: 'window_warning',
  stale_subject: 'window_warning',
  governance_blocker: 'governance_blocker',
  governance_warning: 'governance_warning',
  revenue_leakage: 'revenue_leakage',
  earned_but_not_invoiced: 'earned_but_not_invoiced',
  invoiceable_missing: 'invoiceable_missing',
  screen_failure_billable: 'screen_failure_billable',
  pass_through_unreimbursed: 'pass_through_unreimbursed',
  stipend_unreconciled: 'stipend_unreconciled',
  overdue_financial: 'overdue_financial',
  disputed_payment: 'disputed_payment',
  reverted_payment: 'reverted_payment',
  written_off_payment: 'written_off_payment',
  lab_worsening: 'lab_worsening',
  lab_consecutive_worsening: 'lab_consecutive_worsening',
  lab_consecutive_abnormal: 'lab_consecutive_abnormal',
  lab_missing_repeat: 'lab_missing_repeat',
  lab_follow_up_overdue: 'lab_follow_up_overdue',
  lab_safety_review: 'lab_safety_review',
  sae_reporting_overdue: 'sae_reporting_overdue',
  sae_reporting_due_soon: 'sae_reporting_due_soon',
  sae_sponsor_pending: 'sae_sponsor_pending',
}

const SIGNAL_TITLES: Record<SubjectSignalKind, string> = {
  missed_visit: 'Protect visit window',
  out_of_window: 'Protect visit window',
  overdue_action: 'Complete overdue action',
  open_query: 'Resolve open query',
  blocked_procedure: 'Unblock procedure execution',
  needs_resign: 'Re-sign visit closeout',
  window_warning: 'Protect visit window',
  unsigned_procedure_48h: 'Obtain PI signature',
  window_closing_today: 'Protect visit window',
  stale_subject: 'Refresh subject follow-up',
  governance_blocker: 'Triage governance blocker',
  governance_warning: 'Review governance warning',
  revenue_leakage: 'Review financial leakage',
  earned_but_not_invoiced: 'Earned but not invoiced',
  invoiceable_missing: 'Invoiceable missing',
  screen_failure_billable: 'Screen-fail billable at risk',
  pass_through_unreimbursed: 'Recover pass-through',
  stipend_unreconciled: 'Reconcile stipend',
  overdue_financial: 'Overdue invoice/payment',
  disputed_payment: 'Disputed payment',
  reverted_payment: 'Reverted payment',
  written_off_payment: 'Write-off visibility',
  lab_worsening: 'Lab trend worsening',
  lab_consecutive_worsening: 'Lab worsening over multiple visits',
  lab_consecutive_abnormal: 'Consecutive abnormal lab values',
  lab_missing_repeat: 'Missing repeat lab',
  lab_follow_up_overdue: 'Lab follow-up overdue',
  lab_safety_review: 'Lab safety review recommended',
  sae_reporting_overdue: 'SAE reporting deadline overdue',
  sae_reporting_due_soon: 'SAE reporting deadline approaching',
  sae_sponsor_pending: 'SAE sponsor notification pending',
}

const SIGNAL_OWNER_ROLES: Record<SubjectSignalKind, string> = {
  missed_visit: 'Site Coordinator',
  out_of_window: 'Site Coordinator',
  overdue_action: 'Data Coordinator',
  open_query: 'Data Coordinator',
  blocked_procedure: 'Site Coordinator',
  needs_resign: 'PI',
  window_warning: 'Site Coordinator',
  unsigned_procedure_48h: 'PI',
  window_closing_today: 'Site Coordinator',
  stale_subject: 'Site Coordinator',
  governance_blocker: 'PI',
  governance_warning: 'Site Coordinator',
  revenue_leakage: 'Finance Ops',
  earned_but_not_invoiced: 'Finance Ops',
  invoiceable_missing: 'Finance Ops',
  screen_failure_billable: 'Site Coordinator',
  pass_through_unreimbursed: 'Finance Ops',
  stipend_unreconciled: 'Finance Ops',
  overdue_financial: 'Finance Ops',
  disputed_payment: 'Finance Ops',
  reverted_payment: 'Finance Ops',
  written_off_payment: 'Finance Ops',
  lab_worsening: 'Site Coordinator',
  lab_consecutive_worsening: 'PI',
  lab_consecutive_abnormal: 'PI',
  lab_missing_repeat: 'Site Coordinator',
  lab_follow_up_overdue: 'PI',
  lab_safety_review: 'PI',
  sae_reporting_overdue: 'PI',
  sae_reporting_due_soon: 'PI',
  sae_sponsor_pending: 'PI',
}

const SIGNAL_PRIORITIES: Record<SubjectSignalKind, number> = {
  missed_visit: 92,
  out_of_window: 90,
  overdue_action: 72,
  open_query: 70,
  blocked_procedure: 95,
  needs_resign: 88,
  window_warning: 55,
  unsigned_procedure_48h: 84,
  window_closing_today: 62,
  stale_subject: 45,
  governance_blocker: 86,
  governance_warning: 60,
  revenue_leakage: 78,
  earned_but_not_invoiced: 81,
  invoiceable_missing: 82,
  screen_failure_billable: 50,
  pass_through_unreimbursed: 85,
  stipend_unreconciled: 74,
  overdue_financial: 88,
  disputed_payment: 76,
  reverted_payment: 94,
  written_off_payment: 92,
  lab_worsening: 79,
  lab_consecutive_worsening: 93,
  lab_consecutive_abnormal: 94,
  lab_missing_repeat: 68,
  lab_follow_up_overdue: 92,
  lab_safety_review: 86,
  sae_reporting_overdue: 98,
  sae_reporting_due_soon: 90,
  sae_sponsor_pending: 92,
}

function operationalStateToLegacySeverity(
  state: ScoredSubject['operationalState'],
): SubjectRiskSeverity {
  switch (state) {
    case 'critical':
      return 'critical'
    case 'risk':
      return 'attention'
    case 'watch':
      return 'warning'
    default:
      return 'warning'
  }
}

function contextLinks(
  studyId: string,
  subjectId: string,
  signalSource: string,
  entityId: string | null,
): { contextHref: string; contextLabel: string; linkedObjectLabel: string } {
  if (signalSource.startsWith('visits:') && entityId) {
    return { contextHref: performanceVisitHref(entityId), contextLabel: 'Open visit', linkedObjectLabel: 'Visit' }
  }
  if (signalSource.startsWith('subject_workflow_actions:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=workflow`,
      contextLabel: 'Open workflow',
      linkedObjectLabel: 'Workflow action',
    }
  }
  if (signalSource.startsWith('procedure_executions:')) {
    return {
      contextHref: performanceSubjectVisitsHref(studyId, subjectId),
      contextLabel: 'Subject visits',
      linkedObjectLabel: 'Procedure execution',
    }
  }
  if (signalSource.startsWith('visit_snapshot_queries:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=workflow`,
      contextLabel: 'Open query context',
      linkedObjectLabel: 'Query',
    }
  }
  if (signalSource.startsWith('governance_signals:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=protocol-deviations`,
      contextLabel: 'Open governance context',
      linkedObjectLabel: 'Governance signal',
    }
  }
  if (signalSource.startsWith('visit_financial_runtime_projections:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=visits`,
      contextLabel: 'Open financial context',
      linkedObjectLabel: 'Financial projection',
    }
  }
  if (signalSource.startsWith('longitudinal_labs:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=documents`,
      contextLabel: 'Open lab context',
      linkedObjectLabel: 'Lab result',
    }
  }
  return {
    contextHref: performanceSubjectHref(studyId, subjectId),
    contextLabel: 'Subject chart',
    linkedObjectLabel: 'Subject',
  }
}

export function scoredSubjectToQueueItem(row: ScoredSubject): SubjectRiskQueueItem {
  const reasonKind = SIGNAL_TO_REASON[row.primarySignalKind]
  const actionCode = recommendedActionForSubjectSignal(row.primarySignalKind)
  const actionLabel = recommendedActionLabel(actionCode)
  const entityId = row.primarySignalEntityId
  const { contextHref, contextLabel, linkedObjectLabel } = contextLinks(
    row.studyId,
    row.subjectId,
    row.primarySignalSource,
    entityId,
  )
  const title = SIGNAL_TITLES[row.primarySignalKind]
  const ownerRole = SIGNAL_OWNER_ROLES[row.primarySignalKind]
  const priority = SIGNAL_PRIORITIES[row.primarySignalKind]

  const detailLines: string[] = []
  if (row.signalAgeHours > 0) detailLines.push(`Age: ${row.signalAgeHours}h`)
  detailLines.push(`Action: ${actionLabel}`)

  return {
    id: `subject-${row.subjectId}`,
    title,
    priority,
    ownerRole,
    subjectId: row.subjectId,
    studyId: row.studyId,
    subjectIdentifier: row.subjectIdentifier,
    studyName: row.studyName,
    severity: operationalStateToLegacySeverity(row.operationalState),
    reasonKind,
    reasonLabel: SUBJECT_RISK_REASON_LABELS[reasonKind],
    reason: row.detailText || actionLabel,
    detail: row.detailText || actionLabel,
    recommendedNextStep: actionLabel,
    sortDate: row.sortDate,
    detailLines,
    subjectHref: performanceSubjectHref(row.studyId, row.subjectId),
    contextHref,
    contextLabel,
    linkedObjectLabel,
    linkedObjectHref: contextHref,
    operationalState: row.operationalState,
    recommendedAction: actionCode,
  }
}

export function buildScoredRiskQueueFromSignals(
  signals: SubjectSignalInput[],
  limit = RISK_QUEUE_DISPLAY_LIMIT,
): SubjectRiskQueueItem[] {
  const scored = dedupeScoredSubjectsBySubjectId(scoreSubjectSignals(signals))
  return capScoredSubjects(scored, limit).map(scoredSubjectToQueueItem)
}

export function vpiRowsToSubjectSignals(rows: VpiSubjectRiskSignalRow[]): SubjectSignalInput[] {
  const out: SubjectSignalInput[] = []
  for (const row of rows) {
    if (!isSubjectSignalKind(row.signal_kind)) continue
    const entityId = row.signal_entity_id
      ? String(row.signal_entity_id)
      : row.signal_source.includes(':')
        ? row.signal_source.split(':')[1] ?? null
        : null

    out.push({
      organizationId: row.organization_id,
      studyId: row.study_id,
      subjectId: row.subject_id,
      subjectIdentifier: row.subject_identifier ?? 'Subject',
      studyName: row.study_name ?? 'Study',
      signalKind: row.signal_kind,
      signalSource: row.signal_source,
      signalEntityId: entityId,
      signalCreatedAt: row.signal_created_at,
      signalAgeHours: row.signal_age_hours,
      detailText: row.recommended_action,
    })
  }
  return out
}

export function buildScoredRiskQueueFromVpiRows(
  rows: VpiSubjectRiskSignalRow[],
  limit = RISK_QUEUE_DISPLAY_LIMIT,
): SubjectRiskQueueItem[] {
  return buildScoredRiskQueueFromSignals(vpiRowsToSubjectSignals(rows), limit)
}

/** Fallback path: collapse legacy per-signal queue rows to one row per subject. */
export function dedupeLegacyRiskQueueBySubjectId(
  items: SubjectRiskQueueItem[],
): SubjectRiskQueueItem[] {
  const signals: SubjectSignalInput[] = []

  for (const item of items) {
    const kind = legacyReasonToSignalKind(item.reasonKind)
    signals.push({
      organizationId: '',
      studyId: item.studyId,
      subjectId: item.subjectId,
      subjectIdentifier: item.subjectIdentifier,
      studyName: item.studyName,
      signalKind: kind,
      signalSource: `legacy:${item.id}`,
      signalEntityId: null,
      signalCreatedAt: item.sortDate,
      signalAgeHours: 0,
      detailText: item.detail,
    })
  }

  return buildScoredRiskQueueFromSignals(signals, RISK_QUEUE_DISPLAY_LIMIT)
}

function legacyReasonToSignalKind(reason: SubjectRiskReasonKind): SubjectSignalKind {
  switch (reason) {
    case 'missed_visit':
      return 'missed_visit'
    case 'out_of_window':
      return 'out_of_window'
    case 'overdue_action':
      return 'overdue_action'
    case 'open_query':
      return 'open_query'
    case 'blocked_procedure':
      return 'blocked_procedure'
    case 'needs_resign':
      return 'needs_resign'
    case 'governance_blocker':
      return 'governance_blocker'
    case 'governance_warning':
      return 'governance_warning'
    case 'revenue_leakage':
      return 'revenue_leakage'
    case 'earned_but_not_invoiced':
      return 'earned_but_not_invoiced'
    case 'invoiceable_missing':
      return 'invoiceable_missing'
    case 'screen_failure_billable':
      return 'screen_failure_billable'
    case 'pass_through_unreimbursed':
      return 'pass_through_unreimbursed'
    case 'stipend_unreconciled':
      return 'stipend_unreconciled'
    case 'overdue_financial':
      return 'overdue_financial'
    case 'disputed_payment':
      return 'disputed_payment'
    case 'reverted_payment':
      return 'reverted_payment'
    case 'written_off_payment':
      return 'written_off_payment'
    default:
      return 'window_warning'
  }
}

export { STATE_PRIORITY_RANK }
