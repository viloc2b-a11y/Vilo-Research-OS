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
  'blocked_procedure',
  'window_warning',
  'unsigned_procedure_48h',
  'window_closing_today',
  'stale_subject',
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
  blocked_procedure: 'blocked_procedure',
  window_warning: 'window_warning',
  unsigned_procedure_48h: 'window_warning',
  window_closing_today: 'window_warning',
  stale_subject: 'window_warning',
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
): { contextHref: string; contextLabel: string } {
  if (signalSource.startsWith('visits:') && entityId) {
    return { contextHref: performanceVisitHref(entityId), contextLabel: 'Open visit' }
  }
  if (signalSource.startsWith('subject_workflow_actions:')) {
    return {
      contextHref: `${performanceSubjectHref(studyId, subjectId)}?tab=workflow`,
      contextLabel: 'Open workflow',
    }
  }
  if (signalSource.startsWith('procedure_executions:')) {
    return {
      contextHref: performanceSubjectVisitsHref(studyId, subjectId),
      contextLabel: 'Subject visits',
    }
  }
  return { contextHref: performanceSubjectHref(studyId, subjectId), contextLabel: 'Subject chart' }
}

export function scoredSubjectToQueueItem(row: ScoredSubject): SubjectRiskQueueItem {
  const reasonKind = SIGNAL_TO_REASON[row.primarySignalKind]
  const actionCode = recommendedActionForSubjectSignal(row.primarySignalKind)
  const actionLabel = recommendedActionLabel(actionCode)
  const entityId = row.primarySignalEntityId
  const { contextHref, contextLabel } = contextLinks(
    row.studyId,
    row.subjectId,
    row.primarySignalSource,
    entityId,
  )

  const detailLines: string[] = []
  if (row.signalAgeHours > 0) detailLines.push(`Age: ${row.signalAgeHours}h`)
  detailLines.push(`Action: ${actionLabel}`)

  return {
    id: `subject-${row.subjectId}`,
    subjectId: row.subjectId,
    studyId: row.studyId,
    subjectIdentifier: row.subjectIdentifier,
    studyName: row.studyName,
    severity: operationalStateToLegacySeverity(row.operationalState),
    reasonKind,
    reasonLabel: SUBJECT_RISK_REASON_LABELS[reasonKind],
    detail: row.detailText || actionLabel,
    sortDate: row.sortDate,
    detailLines,
    subjectHref: performanceSubjectHref(row.studyId, row.subjectId),
    contextHref,
    contextLabel,
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
    case 'blocked_procedure':
      return 'blocked_procedure'
    default:
      return 'window_warning'
  }
}

export { STATE_PRIORITY_RANK }
