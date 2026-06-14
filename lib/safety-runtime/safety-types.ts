export const SAFETY_EVENT_TYPE = {
  AE: 'ae',
  SAE: 'sae',
} as const

export type SafetyEventType = (typeof SAFETY_EVENT_TYPE)[keyof typeof SAFETY_EVENT_TYPE]

export const SAFETY_EVENT_STATUS = {
  CANDIDATE: 'candidate',
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  CLOSED: 'closed',
} as const

export type SafetyEventStatus = (typeof SAFETY_EVENT_STATUS)[keyof typeof SAFETY_EVENT_STATUS]

export const SOURCE_TYPE = {
  MANUAL: 'manual',
  LAB_SIGNAL: 'lab_signal',
  PROTOCOL_DEVIATION: 'protocol_deviation',
  SOURCE_REVIEW: 'source_review',
} as const

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE]

export const SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
} as const

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY]

export const RELATEDNESS = {
  UNRELATED: 'unrelated',
  UNLIKELY: 'unlikely',
  POSSIBLE: 'possible',
  PROBABLE: 'probable',
  DEFINITE: 'definite',
} as const

export type Relatedness = (typeof RELATEDNESS)[keyof typeof RELATEDNESS]

export const SAE_OUTCOME = {
  RECOVERED: 'recovered',
  RECOVERING: 'recovering',
  NOT_RECOVERED: 'not_recovered',
  FATAL: 'fatal',
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
} as const

export type SaeOutcome = (typeof SAE_OUTCOME)[keyof typeof SAE_OUTCOME]

export type SafetyEventTaskType =
  | '15_day_report'
  | 'followup_required'
  | 'sponsor_notification'
  | 'irb_notification'
  | 'resolution_documentation'
  | 'closeout'

export type SafetyEventTaskStatus = 'open' | 'completed' | 'overdue' | 'waived'

export type SafetyEventTask = {
  id: string
  organizationId: string
  safetyEventId: string
  taskType: SafetyEventTaskType
  dueDate: string
  status: SafetyEventTaskStatus
  completedAt: string | null
  completedBy: string | null
  notes: string | null
  createdAt: string
}

export type SafetyEventRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  eventType: SafetyEventType | null
  eventStatus: SafetyEventStatus
  sourceType: SourceType
  description: string
  severity: Severity | null
  relatedness: Relatedness | null
  requiresFollowUp: boolean
  openedAt: string
  closedAt: string | null
  // Lifecycle fields (added in migration 0192)
  reportingDeadlineDate: string | null
  sponsorNotifiedAt: string | null
  sponsorNotificationRequired: boolean
  followUpDueDate: string | null
  followUpCompletedAt: string | null
  outcome: SaeOutcome | null
  resolutionDescription: string | null
  regulatoryReportingRequired: boolean
  expeditedReportSubmittedAt: string | null
  createdBy: string
  updatedBy: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateSafetyEventInput = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  eventType?: SafetyEventType | null
  sourceType?: SourceType
  description: string
  severity?: Severity | null
  relatedness?: Relatedness | null
  requiresFollowUp?: boolean
  openedAt?: string
  metadata?: Record<string, unknown>
}

export type UpdateSafetyEventInput = {
  eventType?: SafetyEventType | null
  eventStatus?: SafetyEventStatus
  description?: string
  severity?: Severity | null
  relatedness?: Relatedness | null
  requiresFollowUp?: boolean
  closedAt?: string | null
  metadata?: Record<string, unknown>
  outcome?: SaeOutcome | null
  resolutionDescription?: string | null
  sponsorNotifiedAt?: string | null
  sponsorNotificationRequired?: boolean
  followUpDueDate?: string | null
  followUpCompletedAt?: string | null
  regulatoryReportingRequired?: boolean
  expeditedReportSubmittedAt?: string | null
  reportingDeadlineDate?: string | null
}

export function mapSafetyEventTaskRow(row: Record<string, unknown>): SafetyEventTask {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    safetyEventId: String(row.safety_event_id),
    taskType: row.task_type as SafetyEventTaskType,
    dueDate: String(row.due_date),
    status: row.status as SafetyEventTaskStatus,
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
    completedBy: row.completed_by != null ? String(row.completed_by) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  }
}

export function mapSafetyEventRow(row: Record<string, unknown>): SafetyEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitId: row.visit_id != null ? String(row.visit_id) : null,
    eventType: row.event_type != null ? (row.event_type as SafetyEventType) : null,
    eventStatus: row.event_status as SafetyEventStatus,
    sourceType: row.source_type as SourceType,
    description: String(row.description),
    severity: row.severity as Severity | null,
    relatedness: row.relatedness as Relatedness | null,
    requiresFollowUp: Boolean(row.requires_follow_up),
    openedAt: String(row.opened_at),
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
    reportingDeadlineDate: row.reporting_deadline_date != null ? String(row.reporting_deadline_date) : null,
    sponsorNotifiedAt: row.sponsor_notified_at != null ? String(row.sponsor_notified_at) : null,
    sponsorNotificationRequired: Boolean(row.sponsor_notification_required ?? false),
    followUpDueDate: row.follow_up_due_date != null ? String(row.follow_up_due_date) : null,
    followUpCompletedAt: row.follow_up_completed_at != null ? String(row.follow_up_completed_at) : null,
    outcome: row.outcome != null ? (row.outcome as SaeOutcome) : null,
    resolutionDescription: row.resolution_description != null ? String(row.resolution_description) : null,
    regulatoryReportingRequired: Boolean(row.regulatory_reporting_required ?? false),
    expeditedReportSubmittedAt: row.expedited_report_submitted_at != null ? String(row.expedited_report_submitted_at) : null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    metadata: row.metadata as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
