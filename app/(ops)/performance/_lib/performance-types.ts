import type {
  OperationalState,
  RecommendedActionCode,
} from '@/lib/performance/scoring'
import type {
  PerformanceLoadStatus,
  PerformanceQueryError,
} from '@/lib/performance/types'

export type SubjectRiskSeverity = 'critical' | 'attention' | 'warning'

export type SubjectRiskReasonKind =
  | 'missed_visit'
  | 'out_of_window'
  | 'overdue_action'
  | 'open_query'
  | 'blocked_procedure'
  | 'needs_resign'
  | 'window_warning'
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

export const SUBJECT_RISK_REASON_LABELS: Record<SubjectRiskReasonKind, string> = {
  missed_visit: 'Missed visit',
  out_of_window: 'Out of window',
  overdue_action: 'Overdue action',
  open_query: 'Open query',
  blocked_procedure: 'Blocked procedure',
  needs_resign: 'Needs re-sign',
  window_warning: 'Window warning',
  governance_blocker: 'Governance blocker',
  governance_warning: 'Governance warning',
  revenue_leakage: 'Revenue risk',
  earned_but_not_invoiced: 'Earned not invoiced',
  invoiceable_missing: 'Invoiceable missing',
  screen_failure_billable: 'Screen-fail billable',
  pass_through_unreimbursed: 'Pass-through risk',
  stipend_unreconciled: 'Stipend unreconciled',
  overdue_financial: 'Overdue invoice/payment',
  disputed_payment: 'Disputed payment',
  reverted_payment: 'Reverted payment',
  written_off_payment: 'Write-off visibility',
  lab_worsening: 'Lab worsening',
  lab_consecutive_worsening: 'Consecutive lab worsening',
  lab_consecutive_abnormal: 'Consecutive abnormal labs',
  lab_missing_repeat: 'Missing repeat lab',
  lab_follow_up_overdue: 'Lab follow-up overdue',
  lab_safety_review: 'Lab safety review',
  sae_reporting_overdue: 'SAE reporting overdue',
  sae_reporting_due_soon: 'SAE reporting due soon',
  sae_sponsor_pending: 'SAE sponsor notification pending',
  consent_overdue: 'Reconsent overdue',
  consent_pending: 'Reconsent required',
  capa_overdue: 'CAPA overdue',
}

export type StudyPerformanceCard = {
  studyId: string
  studyName: string
  studyStatus: string
  subjectCount: number
  enrolledCount?: number
  screeningCount?: number
  randomizedCount?: number
  screenFailedCount?: number
  attributedSubjectCount?: number
  unattributedSubjectCount?: number
  enrollmentTarget?: number | null
  enrollmentEndDate?: string | null
  budgetEvidenceDocumentCount?: number
  contractEvidenceDocumentCount?: number
  activeBudgetReferenceCount?: number
  activeContractReferenceCount?: number
  financialLeakageCount?: number
  leakageScore?: number
  budgetNegotiationReadiness?: 'ready' | 'review_needed' | 'blocked'
  budgetNegotiationReason?: string
  budgetNegotiationNextStep?: string
  activeVisitCount: number
  missedVisitCount: number
  openQueryCount: number
  openFindingsCount?: number
  blockedProcedureCount: number
  lastActivityAt?: string | null
  href: string
  unsignedOver48hCount?: number
  visitsClosingWindowToday?: number
  staleStudyFlag?: boolean
  operationalState?: OperationalState
  recommendedAction?: RecommendedActionCode | null
  // Recruitment intelligence fields (PR2)
  enrollmentVelocity?: number
  velocityTrend?: 'accelerating' | 'stable' | 'decelerating' | 'stalled'
  forecastedCompletionDate?: string | null
  forecastRisk?: 'on_track' | 'at_risk' | 'critical' | 'impossible' | null
  qualifiedPipelineDepth?: number
  leadsRequired?: number
}

export type PortfolioStateSummary = {
  critical: number
  risk: number
  watch: number
  healthy: number
}

export type CoordinatorLoadItem = {
  userId: string
  assignedItems: number
  overdueItems: number
  blockedItems: number
  dueToday: number
  unassignedQueue: number
  lastActiveAt: string | null
}

export type SubjectRiskQueueItem = {
  id: string
  title: string
  priority: number
  ownerRole: string
  subjectId: string
  studyId: string
  subjectIdentifier: string
  studyName: string
  severity: SubjectRiskSeverity
  reasonKind: SubjectRiskReasonKind
  reasonLabel: string
  reason: string
  detail: string
  recommendedNextStep: string
  /** ISO date (YYYY-MM-DD) for coordinator urgency sort — oldest first. */
  sortDate: string
  detailLines: string[]
  subjectHref: string
  contextHref: string
  contextLabel: string
  linkedObjectLabel: string
  linkedObjectHref: string
  /** Phase 7C — optional scoring fields (not rendered in UI yet). */
  operationalState?: OperationalState
  recommendedAction?: RecommendedActionCode
}

export type VisitExecutionSnapshot = {
  totalVisits: number
  byVisitStatus: Record<string, number>
  bySourceStatus: Record<string, number>
  byReviewStatus: Record<string, number>
}

export type { PerformanceLoadStatus, PerformanceQueryError }

export type PerformanceStudyFilterOption = {
  studyId: string
  studyName: string
}

export type PerformanceReadModel = {
  status: PerformanceLoadStatus
  errors: PerformanceQueryError[]
  organizationCount: number
  studyFilter: {
    selectedStudyId: string | null
    selectedStudyName: string | null
    options: PerformanceStudyFilterOption[]
  }
  studyCards: StudyPerformanceCard[]
  riskQueue: SubjectRiskQueueItem[]
  visitSnapshot: VisitExecutionSnapshot
  portfolioSummary: PortfolioStateSummary
  coordinatorLoad: CoordinatorLoadItem[]
}
