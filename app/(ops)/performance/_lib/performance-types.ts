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
  | 'blocked_procedure'
  | 'window_warning'

export const SUBJECT_RISK_REASON_LABELS: Record<SubjectRiskReasonKind, string> = {
  missed_visit: 'Missed visit',
  out_of_window: 'Out of window',
  overdue_action: 'Overdue action',
  blocked_procedure: 'Blocked procedure',
  window_warning: 'Window warning',
}

export type StudyPerformanceCard = {
  studyId: string
  studyName: string
  studyStatus: string
  subjectCount: number
  enrolledCount?: number
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
  subjectId: string
  studyId: string
  subjectIdentifier: string
  studyName: string
  severity: SubjectRiskSeverity
  reasonKind: SubjectRiskReasonKind
  reasonLabel: string
  detail: string
  /** ISO date (YYYY-MM-DD) for coordinator urgency sort — oldest first. */
  sortDate: string
  detailLines: string[]
  subjectHref: string
  contextHref: string
  contextLabel: string
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
