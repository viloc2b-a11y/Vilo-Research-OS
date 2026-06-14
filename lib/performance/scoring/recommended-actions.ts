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
  'protect_enrollment',
  'review_budget_evidence',
  'review_financial_leakage',
  'reconcile_invoice_status',
  'recover_pass_through',
  'reconcile_stipend',
  'review_lab_signal',
  'verify_lab_follow_up',
  'review_sae_compliance',
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
  protect_enrollment: 'Protect enrollment',
  review_budget_evidence: 'Review budget evidence',
  review_financial_leakage: 'Review financial leakage',
  reconcile_invoice_status: 'Reconcile invoice status',
  recover_pass_through: 'Recover pass-through reimbursement',
  reconcile_stipend: 'Reconcile stipend',
  review_lab_signal: 'Review lab signal',
  verify_lab_follow_up: 'Verify lab follow-up',
  review_sae_compliance: 'Review SAE compliance',
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
  open_query: 'review_open_query',
  needs_resign: 'obtain_pi_signature',
  window_closing_today: 'contact_subject_today',
  unsigned_procedure_48h: 'obtain_pi_signature',
  window_warning: 'contact_subject_today',
  stale_subject: 'contact_subject_today',
  governance_blocker: 'triage_assignment',
  governance_warning: 'triage_assignment',
  revenue_leakage: 'triage_assignment',
  earned_but_not_invoiced: 'review_financial_leakage',
  invoiceable_missing: 'review_financial_leakage',
  screen_failure_billable: 'review_financial_leakage',
  pass_through_unreimbursed: 'recover_pass_through',
  stipend_unreconciled: 'reconcile_stipend',
  overdue_financial: 'reconcile_invoice_status',
  disputed_payment: 'reconcile_invoice_status',
  reverted_payment: 'review_financial_leakage',
  written_off_payment: 'review_financial_leakage',
  lab_worsening: 'review_lab_signal',
  lab_consecutive_worsening: 'review_lab_signal',
  lab_consecutive_abnormal: 'review_lab_signal',
  lab_missing_repeat: 'verify_lab_follow_up',
  lab_follow_up_overdue: 'verify_lab_follow_up',
  lab_safety_review: 'review_lab_signal',
  sae_reporting_overdue: 'review_sae_compliance',
  sae_reporting_due_soon: 'review_sae_compliance',
  sae_sponsor_pending: 'review_sae_compliance',
}

const SIGNAL_PRIORITY: Record<SubjectSignalKind, number> = {
  blocked_procedure: 40,
  missed_visit: 39,
  out_of_window: 38,
  overdue_action: 30,
  open_query: 31,
  needs_resign: 35,
  window_closing_today: 29,
  unsigned_procedure_48h: 20,
  window_warning: 19,
  stale_subject: 18,
  governance_blocker: 37,
  governance_warning: 28,
  revenue_leakage: 27,
  earned_but_not_invoiced: 34,
  invoiceable_missing: 33,
  screen_failure_billable: 26,
  pass_through_unreimbursed: 35,
  stipend_unreconciled: 32,
  overdue_financial: 36,
  disputed_payment: 31,
  reverted_payment: 39,
  written_off_payment: 38,
  lab_worsening: 79,
  lab_consecutive_worsening: 93,
  lab_consecutive_abnormal: 94,
  lab_missing_repeat: 68,
  lab_follow_up_overdue: 92,
  lab_safety_review: 86,
  sae_reporting_overdue: 97,
  sae_reporting_due_soon: 89,
  sae_sponsor_pending: 91,
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

  if ((input.financialLeakageCount ?? 0) > 0) return 'review_financial_leakage'
  if (input.blockedProcedureCount > 0) return 'resolve_blocked_validation'
  if (input.missedVisitCount > 2) return 'reschedule_visit'
  if (
    (input.financialLeakageCount ?? 0) > 0 &&
    ((input.budgetEvidenceDocumentCount ?? 0) + (input.contractEvidenceDocumentCount ?? 0) === 0 ||
      (input.activeBudgetReferenceCount ?? 0) + (input.activeContractReferenceCount ?? 0) === 0)
  ) {
    return 'review_budget_evidence'
  }
  if (
    input.enrollmentTarget !== null &&
    input.enrollmentTarget !== undefined &&
    input.enrollmentTarget > 0 &&
    (input.randomizedCount ?? 0) < input.enrollmentTarget
  ) {
    return 'protect_enrollment'
  }
  if (input.openQueryCount > 5) return 'review_open_query'
  if (input.openFindingsCount > 3) return 'triage_assignment'
  if (input.staleStudyFlag) return 'review_stale_study'
  if (input.visitsClosingWindowToday > 0) return 'contact_subject_today'
  if (input.unsignedOver48hCount > 0) return 'obtain_pi_signature'

  return 'triage_assignment'
}
