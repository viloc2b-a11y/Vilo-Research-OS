import { pickPrimarySubjectSignal } from '@/lib/performance/scoring/recommended-actions'
import type {
  OperationalState,
  SubjectSignalInput,
  SubjectSignalKind,
  ScoredSubject,
} from '@/lib/performance/scoring/types'
import { STATE_PRIORITY_RANK } from '@/lib/performance/scoring/types'

const CRITICAL_KINDS: readonly SubjectSignalKind[] = [
  'blocked_procedure',
  'missed_visit',
  'out_of_window',
  'governance_blocker',
  'reverted_payment',
  'written_off_payment',
  'earned_but_not_invoiced',
  'invoiceable_missing',
  'pass_through_unreimbursed',
  'stipend_unreconciled',
  'overdue_financial',
  'disputed_payment',
  'screen_failure_billable',
  'lab_consecutive_worsening',
  'lab_consecutive_abnormal',
  'lab_follow_up_overdue',
]

const RISK_KINDS: readonly SubjectSignalKind[] = [
  'overdue_action',
  'open_query',
  'needs_resign',
  'window_closing_today',
  'governance_warning',
  'revenue_leakage',
  'lab_worsening',
  'lab_missing_repeat',
  'lab_safety_review',
]

const WATCH_KINDS: readonly SubjectSignalKind[] = [
  'unsigned_procedure_48h',
  'window_warning',
  'stale_subject',
]

export function operationalStateForSubjectSignalKind(
  kind: SubjectSignalKind,
): OperationalState {
  if (CRITICAL_KINDS.includes(kind)) return 'critical'
  if (RISK_KINDS.includes(kind)) return 'risk'
  if (WATCH_KINDS.includes(kind)) return 'watch'
  return 'healthy'
}

export function mergeSubjectOperationalState(
  states: OperationalState[],
): OperationalState {
  let best: OperationalState = 'healthy'
  let bestRank = STATE_PRIORITY_RANK.healthy
  for (const state of states) {
    const rank = STATE_PRIORITY_RANK[state]
    if (rank > bestRank) {
      best = state
      bestRank = rank
    }
  }
  return best
}

export function scoreSubjectFromSignalKinds(
  kinds: SubjectSignalKind[],
): OperationalState {
  if (kinds.length === 0) return 'healthy'
  return mergeSubjectOperationalState(
    kinds.map((kind) => operationalStateForSubjectSignalKind(kind)),
  )
}

export function scoreSubjectSignals(
  signals: SubjectSignalInput[],
): ScoredSubject[] {
  const bySubject = new Map<string, SubjectSignalInput[]>()

  for (const signal of signals) {
    const key = `${signal.studyId}:${signal.subjectId}`
    const list = bySubject.get(key) ?? []
    list.push(signal)
    bySubject.set(key, list)
  }

  const scored: ScoredSubject[] = []

  for (const group of bySubject.values()) {
    const first = group[0]
    const kinds = group.map((s) => s.signalKind)
    const operationalState = scoreSubjectFromSignalKinds(kinds)
    if (operationalState === 'healthy') continue

    const primaryKind = pickPrimaryKind(group, kinds)
    const primary =
      group.find((s) => s.signalKind === primaryKind) ?? first

    scored.push({
      organizationId: first.organizationId,
      studyId: first.studyId,
      subjectId: first.subjectId,
      subjectIdentifier: first.subjectIdentifier,
      studyName: first.studyName,
      operationalState,
      priorityRank: STATE_PRIORITY_RANK[operationalState],
      primarySignalKind: primary.signalKind,
      primarySignalSource: primary.signalSource,
      primarySignalEntityId: primary.signalEntityId,
      sortDate: primary.signalCreatedAt.slice(0, 10),
      signalAgeHours: primary.signalAgeHours,
      detailText: primary.detailText,
      signalKinds: kinds,
    })
  }

  return scored
}

function pickPrimaryKind(_group: SubjectSignalInput[], kinds: SubjectSignalKind[]): SubjectSignalKind {
  return pickPrimarySubjectSignal(kinds)
}
