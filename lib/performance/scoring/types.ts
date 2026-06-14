/** Phase 7C operational states (not exposed as UI labels). */
export type OperationalState = 'healthy' | 'watch' | 'risk' | 'critical'

export const OPERATIONAL_STATES: readonly OperationalState[] = [
  'healthy',
  'watch',
  'risk',
  'critical',
] as const

/** Internal sort key — higher number = more urgent. Never surface in UI copy. */
export const STATE_PRIORITY_RANK: Record<OperationalState, number> = {
  healthy: 0,
  watch: 1,
  risk: 2,
  critical: 3,
}

/** Phase 7B / RPC signal_kind values consumed by subject scoring. */
export type SubjectSignalKind =
  | 'missed_visit'
  | 'out_of_window'
  | 'overdue_action'
  | 'open_query'
  | 'blocked_procedure'
  | 'needs_resign'
  | 'window_warning'
  | 'unsigned_procedure_48h'
  | 'window_closing_today'
  | 'stale_subject'
  | 'governance_blocker'
  | 'governance_warning'
  | 'revenue_leakage'
  | 'earned_but_not_invoiced'
  | 'invoiceable_missing'
  | 'screen_failure_billable'
  | 'pass_through_unreimbursed'
  | 'stipend_unreconciled'
  | 'overdue_financial'
  | 'disputed_payment'
  | 'reverted_payment'
  | 'written_off_payment'
  | 'lab_worsening'
  | 'lab_consecutive_worsening'
  | 'lab_consecutive_abnormal'
  | 'lab_missing_repeat'
  | 'lab_follow_up_overdue'
  | 'lab_safety_review'
  | 'sae_reporting_overdue'
  | 'sae_reporting_due_soon'
  | 'sae_sponsor_pending'
  | 'consent_overdue'
  | 'consent_pending'
  | 'capa_overdue'

export type SubjectSignalInput = {
  organizationId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string
  studyName: string
  signalKind: SubjectSignalKind
  signalSource: string
  signalEntityId: string | null
  signalCreatedAt: string
  signalAgeHours: number
  detailText: string
}

export type StudyHealthInput = {
  studyId: string
  blockedProcedureCount: number
  missedVisitCount: number
  openQueryCount: number
  openFindingsCount: number
  unsignedOver48hCount: number
  visitsClosingWindowToday: number
  enrollmentTarget?: number | null
  randomizedCount?: number
  enrollmentEndDate?: string | null
  budgetEvidenceDocumentCount?: number
  contractEvidenceDocumentCount?: number
  activeBudgetReferenceCount?: number
  activeContractReferenceCount?: number
  financialLeakageCount?: number
  staleStudyFlag: boolean
}

export type ScoredSubject = {
  organizationId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string
  studyName: string
  operationalState: OperationalState
  /** @internal */
  priorityRank: number
  primarySignalKind: SubjectSignalKind
  primarySignalSource: string
  primarySignalEntityId: string | null
  sortDate: string
  signalAgeHours: number
  detailText: string
  signalKinds: SubjectSignalKind[]
}

export type ScoredStudy = {
  studyId: string
  operationalState: OperationalState
  /** @internal */
  priorityRank: number
}
