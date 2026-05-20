import type { OperationalState, SubjectSignalKind } from '@/lib/performance/scoring/types'
import type { StudyHealthInput } from '@/lib/performance/scoring/types'

/** Controlled vocabulary — validator enforces this set only. */
export const RECOMMENDED_ACTION_CODES = [
  'contact_subject_today',
  'resolve_blocked_validation',
  'obtain_pi_signature',
  'reschedule_visit',
  'review_open_query',
  'triage_assignment',
  'review_stale_study',
] as const

export type RecommendedActionCode = (typeof RECOMMENDED_ACTION_CODES)[number]

const ACTION_LABELS: Record<RecommendedActionCode, string> = {
  contact_subject_today: 'Contact subject today',
  resolve_blocked_validation: 'Resolve blocked validation',
  obtain_pi_signature: 'Obtain PI signature',
  reschedule_visit: 'Reschedule visit',
  review_open_query: 'Review open query',
  triage_assignment: 'Triage assignment',
  review_stale_study: 'Review stale study',
}

export function recommendedActionLabel(code: RecommendedActionCode): string {
  return ACTION_LABELS[code]
}

export function isRecommendedActionCode(value: string): value is RecommendedActionCode {
  return (RECOMMENDED_ACTION_CODES as readonly string[]).includes(value)
}

const SUBJECT_SIGNAL_ACTION: Record<SubjectSignalKind, RecommendedActionCode> = {
  blocked_procedure: 'resolve_blocked_validation',
  missed_visit: 'reschedule_visit',
  out_of_window: 'reschedule_visit',
  overdue_action: 'review_open_query',
  window_closing_today: 'contact_subject_today',
  unsigned_procedure_48h: 'obtain_pi_signature',
  window_warning: 'contact_subject_today',
  stale_subject: 'contact_subject_today',
}

const SIGNAL_PRIORITY: Record<SubjectSignalKind, number> = {
  blocked_procedure: 40,
  missed_visit: 39,
  out_of_window: 38,
  overdue_action: 30,
  window_closing_today: 29,
  unsigned_procedure_48h: 20,
  window_warning: 19,
  stale_subject: 18,
}

export function recommendedActionForSubjectSignal(
  kind: SubjectSignalKind,
): RecommendedActionCode {
  return SUBJECT_SIGNAL_ACTION[kind]
}

export function pickPrimarySubjectSignal(
  kinds: SubjectSignalKind[],
): SubjectSignalKind {
  let best: SubjectSignalKind = kinds[0]
  let bestScore = SIGNAL_PRIORITY[best] ?? 0
  for (const kind of kinds) {
    const score = SIGNAL_PRIORITY[kind] ?? 0
    if (score > bestScore) {
      best = kind
      bestScore = score
    }
  }
  return best
}

export function recommendedActionForStudy(
  input: StudyHealthInput,
  state: OperationalState,
): RecommendedActionCode | null {
  if (state === 'healthy') return null

  if (input.blockedProcedureCount > 0) return 'resolve_blocked_validation'
  if (input.missedVisitCount > 2) return 'reschedule_visit'
  if (input.openQueryCount > 5) return 'review_open_query'
  if (input.openFindingsCount > 3) return 'triage_assignment'
  if (input.staleStudyFlag) return 'review_stale_study'
  if (input.visitsClosingWindowToday > 0) return 'contact_subject_today'
  if (input.unsignedOver48hCount > 0) return 'obtain_pi_signature'

  return 'triage_assignment'
}
